'use strict'

const h = require('chainlink-test-helpers')
const ethers = require('ethers')
const abi = require('ethereumjs-abi')
const { expectRevert } = require('openzeppelin-test-helpers')
const request = require('request-promise-native')
const externalAdapter = require('../app.js')
const adapterPort = 3003
const adapterURL = `http://localhost:${adapterPort}`

contract('Mixicle', accounts => {
  const Oracle = artifacts.require('Oracle.sol')
  const Mixicle = artifacts.require('Mixicle.sol')

  const aliceKey = new ethers.Wallet(
    '0dbbe8e4ae425a6d2687f1a7e3ba17bc98c673636790f1b8ad91193c05875ef1'
  )
  const bobKey = new ethers.Wallet(
    'c88b703fb08cbea894b6aeff5a544fb92e78a18e19814cd85da83b71f772aa6c'
  )
  const adapterKey = new ethers.Wallet(
    '388c684f0ba1ef5017716adb5d21a053ea8e90277d0868337519f97bede61418'
  )

  const defaultAccount = accounts[0]
  const oracleNode = accounts[1]
  const alice = accounts[2]
  const bob = accounts[3]
  const adapter = accounts[4]
  const payee1 = '0x3F94B548fb009329699eA22f4a23116438E65D0d'
  const payee2 = '0x8E10dba0d668e4f91cb65E962e176E07D93DD512'

  assert(alice == aliceKey.address)
  assert(bob == bobKey.address)
  assert(adapter == adapterKey.address)

  const encodeDealParams = dealParams => {
    return ethers.utils.concat([
      ethers.utils.padZeros(
        ethers.utils.arrayify(ethers.utils.bigNumberify(dealParams.roundIndex)),
        32
      ),
      ethers.utils.padZeros(
        ethers.utils.arrayify(
          ethers.utils.bigNumberify(dealParams.requiredBalance)
        ),
        32
      ),
      ethers.utils.padZeros(
        ethers.utils.arrayify(
          ethers.utils.bigNumberify(dealParams.setupDeadline)
        ),
        32
      ),
      ethers.utils.padZeros(
        ethers.utils.arrayify(
          ethers.utils.bigNumberify(dealParams.reportDeadline)
        ),
        32
      ),
      ethers.utils.padZeros(
        ethers.utils.arrayify(ethers.utils.bigNumberify(dealParams.dealId)),
        32
      ),
      ethers.utils.padZeros(
        ethers.utils.arrayify(
          ethers.utils.bigNumberify(dealParams.chainlinkPayment)
        ),
        32
      ),
      ethers.utils.padZeros(ethers.utils.arrayify(dealParams.termsCommit), 32)
    ])
  }

  const allSign = async message => {
    let messageHash = ethers.utils.keccak256(ethers.utils.arrayify(message))

    const aliceFlat = await aliceKey.signingKey.signDigest(messageHash)
    const aliceSig = ethers.utils.splitSignature(aliceFlat)

    const bobFlat = await bobKey.signingKey.signDigest(messageHash)
    const bobSig = ethers.utils.splitSignature(bobFlat)

    const eaFlat = await adapterKey.signingKey.signDigest(messageHash)
    const eaSig = ethers.utils.splitSignature(eaFlat)

    return {
      v1: aliceSig.v,
      r1: aliceSig.r,
      s1: aliceSig.s,
      v2: bobSig.v,
      r2: bobSig.r,
      s2: bobSig.s,
      vea: eaSig.v,
      rea: eaSig.r,
      sea: eaSig.s,
    }
  }

  const newMixicleRound = async (dealParams, sigs=null) => {
    let encoded = encodeDealParams(dealParams)
    sigs = sigs || await allSign(encoded)
    // const sigs = await allSign(encoded)
    return mixi.newRound(
      encoded,
      sigs.v1, sigs.r1, sigs.s1,
      sigs.v2, sigs.r2, sigs.s2,
      sigs.vea, sigs.rea, sigs.sea,
      {
        from: bob
      })
  }

  describe('#test helpers', () => {
    it('encodeDealParams test vector', () => {
      const expected =
        '0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000029a2241af62c000000000000000000000000000000000000000000000000000000000000004c4b4000000000000000000000000000000000000000000000000000000000005b8d80abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef4700000000000000000000000000000000000000000000000098a7d9b8314c00001122334455667788112233445566778811223344556677881122334455667788'
      let actual = encodeDealParams({
        roundIndex: 2,
        requiredBalance: ethers.utils.parseEther('3'),
        setupDeadline: 5000000,
        reportDeadline: 6000000,
        dealId:
          '0xabcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47',
        chainlinkPayment: ethers.utils.parseEther('11'),
        termsCommit:
          '0x1122334455667788112233445566778811223344556677881122334455667788'
      })
      assert.equal(expected, ethers.utils.hexlify(actual))
    })
  })

  // These parameters are used to validate the data was received
  // on the deployed oracle contract. The Job ID only represents
  // the type of data, but will not work on a public testnet.
  // For the latest JobIDs, visit our docs here:
  // https://docs.chain.link/docs/testnet-oracles
  const jobId = web3.utils.toHex('4c7b7ffb66b344fbaa64995af81e355a')

  const etherPayment = web3.utils.toWei('3', 'ether')
  // Represents 11 LINK for testnet requests
  const linkPayment = web3.utils.toWei('11', 'ether')
  const dealParams = {
    roundIndex: 1,
    requiredBalance: etherPayment,
    setupDeadline: 5000000,
    reportDeadline: 6000000,
    dealId:
      '0xabcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47abcdef47',
    chainlinkPayment: linkPayment,
    termsCommit:
      '0x1122334455667788112233445566778811223344556677881122334455667788'
  }
  let link, oc, mixi

  beforeEach(async () => {
    link = await h.linkContract(defaultAccount)
    oc = await Oracle.new(link.address, { from: defaultAccount })
    mixi = await Mixicle.new(
      link.address,
      oc.address,
      adapter,
      alice,
      bob,
      jobId,
      {
        from: bob
      }
    )
    await oc.setFulfillmentPermission(oracleNode, true, {
      from: defaultAccount
    })

  })

  describe('#newRound', () => {
    context('without LINK', () => {
      it('reverts', async () => {
        await expectRevert.unspecified(newMixicleRound(dealParams))
      })
    })

    context('with LINK', () => {
      let request

      beforeEach(async () => {
        await link.transfer(mixi.address, linkPayment)
      })

      context('sending a request to a specific oracle contract address', () => {
        it('triggers a log event in the new Oracle contract', async () => {
          let tx = await newMixicleRound(dealParams)
          request = h.decodeRunRequest(tx.receipt.rawLogs[3])
          assert.equal(oc.address, tx.receipt.rawLogs[3].address)
          assert.equal(
            request.topic,
            web3.utils.keccak256(
              'OracleRequest(bytes32,address,bytes32,uint256,address,bytes4,uint256,uint256,bytes)'
            )
          )
          console.log(`newRound cost ${tx.receipt.gasUsed} gas.`)
        })

        context('when there is an invalid signature', () => {
          it('reverts', async () => {
            let invalidSigs = await allSign(encodeDealParams(dealParams))
            invalidSigs.rea = invalidSigs.r1
            await expectRevert(
              newMixicleRound(dealParams, invalidSigs),
              'incorrect sig of ea'
            )
          })
        })
      })
    })
  })

  describe('#refund', () => {
    it('after setupDeadline expires', async () => {
      let modifiedDealParams = Object.assign({}, dealParams)
      modifiedDealParams.setupDeadline = await web3.eth.getBlockNumber() + 9
      modifiedDealParams.requiredBalance = web3.utils.toWei('99999999', 'ether')
      await link.transfer(mixi.address, linkPayment)
      await newMixicleRound(modifiedDealParams)
      await mixi.fund(bob, { from: bob, value: etherPayment })
      // Advance chain by ten blocks
      for (let i = 0; i < 10; i++) {
        await web3.currentProvider.send({
          id: 0,
          jsonrpc: "2.0",
          method: "evm_mine",
        }, (error, result) => {
          if (error) {
            throw error;
          }
        })
      }

      let balanceBeforeRefund = await web3.eth.getBalance(bob)
      let txRefund = await mixi.refund(bob, {from: alice})
      console.log(`refund cost ${txRefund.receipt.gasUsed} gas.`)
      let balanceAfterRefund = await web3.eth.getBalance(bob)

      assert.equal(balanceAfterRefund - balanceBeforeRefund, etherPayment)
    })
  })

  describe('#report', () => {
    const expected = 50000
    const tag = '0x0d1d4e623d10f9fba5db95830f7d3839'
    const round = '00000000000000000000000000000001'
    const responseHex = `${tag}${round}`
    const response = web3.utils.toAscii(responseHex)
    let request

    beforeEach(async () => {
      await link.transfer(mixi.address, linkPayment)
      let tx = await newMixicleRound(dealParams)
      request = h.decodeRunRequest(tx.receipt.rawLogs[3])
      let fundTx = await mixi.fund(bob, { from: bob, value: etherPayment })
      console.log(`fund cost ${fundTx.receipt.gasUsed} gas.`)
      let fullfillTx = await h.fulfillOracleRequest(oc, request, response, {
        from: oracleNode
      })
      console.log(`fullfillTx cost ${fullfillTx.receipt.gasUsed} gas.`)
    })

    it('records the data given to it by the oracle', async () => {
      const outcome = await mixi.outcome.call()
      assert.equal(outcome, tag)
    })

    context('when my contract does not recognize the request ID', () => {
      const otherId = web3.utils.toHex('otherId')

      beforeEach(async () => {
        request.id = otherId
      })

      it('does not accept the data provided', async () => {
        await expectRevert.unspecified(
          h.fulfillOracleRequest(oc, request, response, {
            from: oracleNode
          })
        )
      })
    })

    context('when called by anyone other than the oracle contract', () => {
      it('does not accept the data provided', async () => {
        await expectRevert(
          mixi.report(request.id, responseHex, {
            from: alice
          }),
          'Source must be the oracle of the request'
        )
      })
    })
  })

  describe('#payout to multiple', () => {
    const tag = '0x0d1d4e623d10f9fba5db95830f7d3839'
    const round = '00000000000000000000000000000001'
    const responseHex = `${tag}${round}`
    const response = web3.utils.toAscii(responseHex)

    const runMixicle = async () => {
      await link.transfer(mixi.address, linkPayment)
      let newRoundTx = await newMixicleRound(dealParams)
      let request = h.decodeRunRequest(newRoundTx.receipt.rawLogs[3])
      mixi.fund(bob, { from: bob, value: etherPayment })
      let fullfillTx = await h.fulfillOracleRequest(oc, request, response, {
        from: oracleNode
      })
      console.log(`fullfillTx cost ${fullfillTx.receipt.gasUsed} gas.`)
    }

    let claimPayout = async (n) => {
      let payees = []
      let amounts = []
      for (let i = 0; i < n; i++) {
        payees.push(ethers.utils.getAddress(ethers.utils.hexlify(ethers.utils.randomBytes(20))))
        amounts.push(ethers.utils.bigNumberify(dealParams.requiredBalance).div(n).toString())
      }

      let encodedSlatePart = '0x' + abi.rawEncode(
        ['uint128', 'bytes16', 'uint256', 'address[]', 'uint256[]'],
        ['1', tag, '0', payees, amounts]
      ).toString('hex')
      const sigs = await allSign(encodedSlatePart)

      let payoutTx = await mixi.payout(
        encodedSlatePart,
        sigs.v1, sigs.r1, sigs.s1,
        sigs.v2, sigs.r2, sigs.s2
      )
      console.log(`payoutTx cost ${payoutTx.receipt.gasUsed} gas for ${n} entries.`)

      for (let i = 0; i < n; i++) {
        assert.equal(amounts[i], await web3.eth.getBalance(payees[i]))
      }
    }

    it('payout to 5 addresses', async () => {
      await runMixicle()
      await claimPayout(5)
    })

    it('payout to 10 addresses', async () => {
      await runMixicle()
      await claimPayout(10)
    })

    it('payout to 20 addresses', async () => {
      await runMixicle()
      await claimPayout(20)
    })

  })

  context('#integration tests w/ external adapter', async () => {
    const proposeNewDeal = async dealParams => {
      return request({
        uri: `${adapterURL}/propose_deal`,
        method: 'POST',
        body: {
          dealParams: ethers.utils.hexlify(encodeDealParams(dealParams)),
          outcomes: [
            {
              predicate: { operator: 'equals', amount: 9000 },
              tag:
                '0x0d1d4e623d10f9fba5db95830f7d383900000000000000000000000000000001'
            },
            {
              predicate: { operator: 'greater', amount: 9000 },
              tag:
                '0xad1d4e623d10f9fba5db95830f7d383900000000000000000000000000000001'
            },
            {
              predicate: { operator: 'lesser', amount: 9000 },
              tag:
                '0x7d1d4e623d10f9fba5db95830f7d383900000000000000000000000000000001'
            }
          ]
        },
        json: true
      }).then(body => {
        const deal = body
        return deal
      })
    }

    const resolveDeal = async deal => {
      return request({
        uri: `${adapterURL}/resolve_deal`,
        method: 'POST',
        body: deal,
        json: true
      }).then(body => {
        const responseHex = body.result
        const response = web3.utils.toAscii(responseHex)
        const tag = responseHex.slice(0, 34)
        const round = web3.utils.toDecimal(responseHex.slice(34))

        return {
          value: response,
          responseHex: responseHex,
          tag: tag,
          round: round.toString()
        }
      })
    }


    beforeEach(async () => {
      externalAdapter.start(adapterPort, adapterKey.privateKey)
    })

    afterEach(async () => {
      externalAdapter.stop()
    })

    it('Complete round', async () => {
      await link.transfer(mixi.address, linkPayment)

      const deal = await proposeNewDeal(dealParams)

      let dealSigs = await allSign(encodeDealParams(dealParams))
      Object.assign(dealSigs, {
        vea: deal.signatureParts.v,
        rea: deal.signatureParts.r,
        sea: deal.signatureParts.s,
      })

      const newRoundTx = await newMixicleRound(dealParams, dealSigs)
      const request = h.decodeRunRequest(newRoundTx.receipt.rawLogs[3])

      mixi.fund(bob, { from: bob, value: etherPayment })

      const answer = await resolveDeal(deal)

      await h.fulfillOracleRequest(oc, request, answer.value, {
        from: oracleNode
      })

      const payee = ethers.utils.getAddress('0xc0ffeeeec0ffeeeec0ffeeeec0ffeeeec0ffeeee')
      const encodedSlatePart = '0x' + abi.rawEncode(
        ['uint128', 'bytes16', 'uint256', 'address[]', 'uint256[]'],
        [answer.round, answer.tag, '0', [payee], [etherPayment]]
      ).toString('hex')
      const slateSigs = await allSign(encodedSlatePart)

      await mixi.payout(
        encodedSlatePart,
        slateSigs.v1, slateSigs.r1, slateSigs.s1,
        slateSigs.v2, slateSigs.r2, slateSigs.s2
      )

      assert.equal(etherPayment, await web3.eth.getBalance(payee))
    })
  })
})
