/**
 * This file is based on the repository github.com/submarineswaps/swaps-service created by Alex Bosworth
 */

import ops from '@boltz/bitcoin-ops';
import { reverseBuffer, varuint } from 'liquidjs-lib/src/bufferutils';
import {
  Blinder,
  confidential,
  Creator,
  CreatorInput,
  CreatorOutput,
  crypto,
  Extractor,
  Finalizer,
  networks,
  Pset,
  script,
  Signer,
  Transaction,
  Updater,
  witnessStackToScriptWitness,
  ZKPGenerator,
  ZKPValidator,
} from 'liquidjs-lib';
import Errors from '../consts/Errors';
import { getHexString } from '../Utils';
import { OutputType } from '../consts/Enums';
import { ClaimDetails } from '../consts/Types';
import { scriptBuffersToScript } from './SwapUtils';
import { confi, ecPair, zkpLib } from '../Confidential';

const { confidentialValueToSatoshi } = confidential;

const sighashType = Transaction.SIGHASH_ALL;

/**
 * Claim swaps
 *
 * @param utxos UTXOs that should be claimed or refunded
 * @param destinationScript the output script to which the funds should be sent
 * @param fee how many satoshis should be paid as fee
 * @param isRbf whether the transaction should signal full Replace-by-Fee
 * @param assetHash asset hash of Liquid asset
 * @param blindingKey blinding public key for the output
 * @param timeoutBlockHeight locktime of the transaction; only needed if the transaction is a refund
 */
export const constructClaimTransaction = (
  utxos: ClaimDetails[],
  destinationScript: Buffer,
  fee: number,
  isRbf = true,
  assetHash: string = networks.liquid.assetHash,
  blindingKey?: Buffer,
  timeoutBlockHeight?: number,
): Transaction => {
  for (const input of utxos) {
    if (input.type !== OutputType.Bech32) {
      throw Errors.ONLY_NATIVE_SEGWIT_INPUTS;
    }
  }

  if (
    !utxos.every(
      (utxo) =>
        (utxo.blindingPrivKey === undefined) ===
        (utxos[0].blindingPrivKey === undefined),
    )
  ) {
    throw Errors.INCONSISTENT_BLINDING;
  }

  const pset = Creator.newPset();

  const updater = new Updater(pset);

  let utxoValueSum = BigInt(0);
  for (const [i, utxo] of utxos.entries()) {
    utxoValueSum += BigInt(getOutputValue(utxo));

    const txHash = Buffer.alloc(utxo.txHash.length);
    utxo.txHash.copy(txHash);
    const txid = getHexString(reverseBuffer(txHash));

    pset.addInput(
      new CreatorInput(
        txid,
        utxo.vout,
        isRbf ? 0xfffffffd : 0xffffffff,
        i == 0 ? timeoutBlockHeight : undefined,
      ).toPartialInput(),
    );
    updater.addInSighashType(i, sighashType);

    if (utxo.type === OutputType.Legacy) {
      updater.addInNonWitnessUtxo(i, utxo.legacyTx!);
      updater.addInRedeemScript(i, utxo.redeemScript);
    } else if (utxo.type === OutputType.Compatibility) {
      updater.addInNonWitnessUtxo(i, utxo.legacyTx!);
      updater.addInRedeemScript(
        i,
        scriptBuffersToScript([
          scriptBuffersToScript([
            varuint.encode(ops.OP_0).toString('hex'),
            crypto.sha256(utxo.redeemScript),
          ]),
        ]),
      );
    }

    if (utxo.type !== OutputType.Legacy) {
      updater.addInWitnessUtxo(i, utxo);
      updater.addInWitnessScript(i, utxo.redeemScript);
    }
  }

  updater.addOutputs([
    {
      script: destinationScript,
      blindingPublicKey: blindingKey,
      asset: assetHash,
      amount: Number(utxoValueSum - BigInt(fee)),
      blinderIndex: blindingKey !== undefined ? 0 : undefined,
    },
  ]);

  const addFeeOutput = () => {
    updater.addOutputs([
      {
        amount: fee,
        asset: assetHash,
      },
    ]);
  };

  if (utxos[0].blindingPrivKey !== undefined) {
    // We have to have at least one blinded output if we are spending blinded coins,
    // so we add a small OP_RETURN
    if (blindingKey === undefined) {
      pset.addOutput(
        new CreatorOutput(
          assetHash,
          0,
          Buffer.of(ops.OP_RETURN),
          ecPair.makeRandom().publicKey,
          0,
        ).toPartialOutput(),
      );
    }

    addFeeOutput();

    blindPset(pset, utxos);
  } else {
    addFeeOutput();
  }

  const signer = new Signer(pset);

  const signatures: Buffer[] = [];

  for (const [i, utxo] of utxos.entries()) {
    const signature = script.signature.encode(
      utxo.keys.sign(pset.getInputPreimage(i, sighashType)),
      sighashType,
    );
    signatures.push(signature);

    signer.addSignature(
      i,
      {
        partialSig: {
          pubkey: utxo.keys.publicKey,
          signature,
        },
      },
      Pset.ECDSASigValidator(zkpLib.ecc),
    );
  }

  const finalizer = new Finalizer(pset);

  for (const [i, utxo] of utxos.entries()) {
    finalizer.finalizeInput(i, () => {
      const finals: {
        finalScriptSig?: Buffer;
        finalScriptWitness?: Buffer;
      } = {};

      if (utxo.type === OutputType.Legacy) {
        finals.finalScriptSig = scriptBuffersToScript([
          signatures[i],
          utxo.preimage,
          ops.OP_PUSHDATA1,
          utxo.redeemScript,
        ]);
      } else if (utxo.type === OutputType.Compatibility) {
        finals.finalScriptSig = scriptBuffersToScript([
          scriptBuffersToScript([
            varuint.encode(ops.OP_0).toString('hex'),
            crypto.sha256(utxo.redeemScript),
          ]),
        ]);
      }

      if (utxo.type !== OutputType.Legacy) {
        finals.finalScriptWitness = witnessStackToScriptWitness([
          signatures[i],
          utxo.preimage,
          utxo.redeemScript,
        ]);
      }

      return finals;
    });
  }

  return Extractor.extract(pset);
};

const getOutputValue = (utxo: ClaimDetails): number => {
  return utxo.blindingPrivKey
    ? Number(confi.unblindOutputWithKey(utxo, utxo.blindingPrivKey).value)
    : confidentialValueToSatoshi(utxo.value);
};

const blindPset = (pset: Pset, utxos: ClaimDetails[]) => {
  const zkpGenerator = new ZKPGenerator(
    zkpLib,
    ZKPGenerator.WithBlindingKeysOfInputs(
      utxos.map((utxo) => utxo.blindingPrivKey!),
    ),
  );
  const zkpValidator = new ZKPValidator(zkpLib);
  const outputBlindingArgs = zkpGenerator.blindOutputs(
    pset,
    Pset.ECCKeysGenerator(zkpLib.ecc),
  );

  const blinder = new Blinder(
    pset,
    zkpGenerator.unblindInputs(pset),
    zkpValidator,
    zkpGenerator,
  );

  blinder.blindLast({ outputBlindingArgs });
};
