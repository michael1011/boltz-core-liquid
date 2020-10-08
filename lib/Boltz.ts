import Networks from './consts/Networks';
import * as Scripts from './swap/Scripts';
import swapScript from './swap/SwapScript';
import { OutputType } from './consts/Enums';
import * as SwapUtils from './swap/SwapUtils';
import ERC20ABI from '../artifacts/ERC20.json';
import { detectSwap } from './swap/SwapDetector';
import EtherSwapABI from '../artifacts/EtherSwap.json';
import ERC20SwapABI from '../artifacts/ERC20Swap.json';
import reverseSwapScript from './swap/ReverseSwapScript';
import { constructClaimTransaction } from './swap/Claim';
import { detectPreimage } from './swap/PreimageDetector';
import * as EthereumUtils from './ethereum/EthereumUtils';
import { constructRefundTransaction } from './swap/Refund';
import { estimateFee, estimateSize } from './FeeCalculator';
import { ScriptElement, TransactionOutput } from './consts/Types';

const ContractABIs = {
  ERC20: ERC20ABI.abi,
  EtherSwap: EtherSwapABI.abi,
  ERC20Swap: ERC20SwapABI.abi,
};

export {
  Networks,

  OutputType,
  ScriptElement,
  TransactionOutput,

  Scripts,

  swapScript,
  reverseSwapScript,

  detectSwap,
  detectPreimage,

  estimateFee,
  estimateSize,

  constructClaimTransaction,
  constructRefundTransaction,

  SwapUtils,

  ContractABIs,
  EthereumUtils,
};
