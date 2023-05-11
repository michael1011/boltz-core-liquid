import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import zkp from '@vulpemventures/secp256k1-zkp';
import { confidential, networks } from 'liquidjs-lib';
import { LBTC_REGTEST } from './Utils';
import { getHexBuffer } from '../../../lib/Utils';
import { Nonce } from '../../../lib/consts/Buffer';
import { OutputType } from '../../../lib/consts/Enums';
import { ClaimDetails } from '../../../lib/consts/Types';
import { prepareConfidential } from '../../../lib/Confidential';
import { constructClaimTransaction } from '../../../lib/swap/Claim';

const bip32 = BIP32Factory(ecc);

describe('Claim', () => {
  beforeAll(async () => {
    prepareConfidential(await zkp());
  });

  const utxo = {
    txHash: getHexBuffer('285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d754'),
    vout: 0,
    value: confidential.satoshiToConfidentialValue(2000),

    preimage: getHexBuffer('b5b2dbb1f0663878ecbc20323b58b92c'),
    keys: bip32.fromBase58('xprv9xgxR6htMdXUXGipynZp1janNrWNYJxaz2o4tH9fdtZqcF26BX5VB88GSM5KgZHWCyAyb8FZpQik2UET84CHfGWXFMG5zWWjmtDMgqYuo19'),
    redeemScript: getHexBuffer('a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac'),
  };

  const claimDetails = [
    {
      ...utxo,
      type: OutputType.Bech32,
      script: getHexBuffer('00206f38b6ce82427d4df080a9833d06cc6c66ab816545c9fd4df50f9d1ca8430b9e'),
      asset: LBTC_REGTEST,
      nonce: Nonce,
    },
    {
      ...utxo,
      type: OutputType.Legacy,
      script: getHexBuffer('a9148f439aff651860bdb28c66500c6e958cfbe7a69387'),
      asset: LBTC_REGTEST,
      nonce: Nonce,
    },
    {
      ...utxo,
      type: OutputType.Compatibility,
      script: getHexBuffer('a9143cdeb56e328a10d3bfe107fd5a16bd73871adb8d87'),
      asset: LBTC_REGTEST,
      nonce: Nonce,
    },
  ];

  const testClaim = (utxos: ClaimDetails[], fee: number) => {
    return constructClaimTransaction(
      utxos,
      getHexBuffer('00140000000000000000000000000000000000000000'),
      fee,
      false,
      networks.regtest.assetHash,
      undefined,
    );
  };

  test('should claim a P2WSH swap', () => {
    const expected =  '010000000101285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d7540000000000ffffffff020125b251070e29ca19043cf33ccd7324e2ddab03ecc4ae0b5e77c4fc0e5cf6c95a01000000000000074d0016001400000000000000000000000000000000000000000125b251070e29ca19043cf33ccd7324e2ddab03ecc4ae0b5e77c4fc0e5cf6c95a010000000000000083000000000000000003473044022027c2920f804a4f00304321c2bd0b704af4d05d0f545af931d59daeb3f293042302205adc8ab5249d359fba8e19d338b00c327380a1faaebc39ea1d3a78127a9be6490110b5b2dbb1f0663878ecbc20323b58b92c64a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac0000000000';

    expect(testClaim([claimDetails[0]], 131).toHex()).toEqual(expected);
  });

  test('should claim a P2SH swap', () => {
    const expected = '010000000001285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d75400000000bf47304402203295216de886194cdcca31b875a505d16d4f2a21096a45863e8a6504c722a38602207f367e1544e113b04cd0256fe8c9611b05e4a34d38d77cdbaf3d8330b20a1ba80110b5b2dbb1f0663878ecbc20323b58b92c4c64a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368acffffffff020125b251070e29ca19043cf33ccd7324e2ddab03ecc4ae0b5e77c4fc0e5cf6c95a0100000000000006be0016001400000000000000000000000000000000000000000125b251070e29ca19043cf33ccd7324e2ddab03ecc4ae0b5e77c4fc0e5cf6c95a010000000000000112000000000000';

    expect(testClaim([claimDetails[1]], 274).toHex()).toEqual(expected);
  });

  test('should claim a P2SH nested P2WSH swap', () => {
    const expected = '010000000101285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d75400000000232200206f38b6ce82427d4df080a9833d06cc6c66ab816545c9fd4df50f9d1ca8430b9effffffff020125b251070e29ca19043cf33ccd7324e2ddab03ecc4ae0b5e77c4fc0e5cf6c95a01000000000000072a0016001400000000000000000000000000000000000000000125b251070e29ca19043cf33ccd7324e2ddab03ecc4ae0b5e77c4fc0e5cf6c95a0100000000000000a6000000000000000003473044022029ee262e7b4e4603d71322d81e1950c22bcb6a2b4cf8115b0f11375cce9e2e1602205c6be00643a67fc63bce953ebe9b42e18f803eadebab346484cb0a60af1c8f420110b5b2dbb1f0663878ecbc20323b58b92c64a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac0000000000';

    expect(testClaim([claimDetails[2]], 166).toHex()).toEqual(expected);
  });

  test('should claim multiple swaps in one transaction', () => {
    const expected = '010000000103285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d7540000000000ffffffff285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d75400000000c0483045022100b06025d584342e3a84151b75edbf96c3d6ae740609d7a6c4ae7c5fbfe5599d7a0220039b79f08f6b19ac5d026d435d0c49123cd8ac76be39d4ee001756ff17ce10360110b5b2dbb1f0663878ecbc20323b58b92c4c64a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368acffffffff285d227e2823c679c224b4d562a9b5b5b7b927badd483df9f4225c6fc761d75400000000232200206f38b6ce82427d4df080a9833d06cc6c66ab816545c9fd4df50f9d1ca8430b9effffffff020125b251070e29ca19043cf33ccd7324e2ddab03ecc4ae0b5e77c4fc0e5cf6c95a0100000000000015860016001400000000000000000000000000000000000000000125b251070e29ca19043cf33ccd7324e2ddab03ecc4ae0b5e77c4fc0e5cf6c95a0100000000000001ea00000000000000000347304402201147dfec9810afefa7760f20711bd99909c0e70def5d077fcd294d0cb3dc94d102200c2203b0d9f68e1add3b228466d0220cf264bd071c411c738d74a9eb94e517d60110b5b2dbb1f0663878ecbc20323b58b92c64a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac000000000000000347304402201147dfec9810afefa7760f20711bd99909c0e70def5d077fcd294d0cb3dc94d102200c2203b0d9f68e1add3b228466d0220cf264bd071c411c738d74a9eb94e517d60110b5b2dbb1f0663878ecbc20323b58b92c64a914a0738c92fde6361f09d28950c7bd0d2bf32b34be87632103be4a251dae719d565ce1d6a7a5787df99fc1ecc1f6e847567981a686f32abce167027802b1752103f7877d4ae985bb30b6f150ad6b6b9935c342432beed1a4781347b169c1e2417368ac0000000000';

    expect(testClaim(claimDetails, 490).toHex()).toEqual(expected);
  });
});
