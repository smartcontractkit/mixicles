# Mixicles

**_Warning: This prototype code is meant to elucidate and test ideas in the Mixicle paper. It is not production-ready, and not meant for deployment._**


## Setup

```
yarn install
```

## Running the Adapter

```
yarn start
```

You can configure the port the adapter runs on by setting `MIXICLES_PORT` and the key it uses to sign by setting `MIXICLES_KEY`.

## Test vector for `roundParams`

Here is a test vector for the following (decoded) `roundParams`:
```
uint128 roundIndex = 2;
uint256 requiredBalance = 3 ether;
uint256 setupDeadline = 5000000;
uint256 reportDeadline = 6000000;
uint256 dealId = 0xabcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47;
uint256 chainlinkPayment = 11 * LINK;
bytes32 termsCommit = bytes32(0x1122334455667788112233445566778811223344556677881122334455667788);
```

encoded using solidity ABI encoding (in our case, simple concatenation + padding to 32 bytes + big-endian numbers):
```
0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000029a2241af62c000000000000000000000000000000000000000000000000000000000000004c4b4000000000000000000000000000000000000000000000000000000000005b8d80abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef4700000000000000000000000000000000000000000000000098a7d9b8314c00001122334455667788112233445566778811223344556677881122334455667788
```

the keccak256 hash of the encoded `roundParams` is signed by the external adapter. it is:
`0xe587d3d48510f67b15a72b9566d6c1e5eef15be530ad0d9c2f52473e8c97d9f7`

### Run the tests

```
yarn test
```

### Example Deal Proposal

```json
{
    "dealParams": "0xabcdef123...",
    "outcomes": [
      {"predicate": {"operator": "lesser", "amount": 9000}, "tag": "a"},
      {"predicate": {"operator": "equals", "amount": 9000}, "tag": "b"},
      {"predicate": {"operator": "greater", "amount": 9000}, "tag": "c"}
    ]
}
```
