pragma solidity ^0.5.8;

import { Oracle as _Oracle } from "chainlink/v0.5/contracts/Oracle.sol";

contract Oracle is _Oracle {
  constructor(address _link) public _Oracle(_link) {
  }
}
