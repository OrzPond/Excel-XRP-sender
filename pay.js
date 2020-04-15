const sender = "" // Sender XRP Address wallet 
const secret = '' // Sender XRP Secret wallet


const ripple = require('ripple-lib')
//const api    = new ripple.RippleAPI({server: 'wss://s.altnet.rippletest.net:51233'}) // TESTNET
const api    = new ripple.RippleAPI({server: 'wss://s1.ripple.com'}) // MAINTET


const XLSX            = require('xlsx')
const workbook        = XLSX.readFile('pay.xlsx')
const sheet_name_list = workbook.SheetNames
var wallet_json       = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]])
// console.log(wallet_json)

var earliestLedgerVersion = 0
var maxLedgerVersion      = 0
var txID                  = ''
var txBlob                = ''
var total_wallet          = 0
var sending_wallet        = 0

api.connect()

async function doPrepare(destination, amount, tag) {
    const preparedTx = await api.prepareTransaction({
        "TransactionType" : "Payment",
        "Account"         : sender,
        "Amount"          : api.xrpToDrops(amount),
        "Destination"     : destination,
        "DestinationTag"  : tag
    }, {
        // Expire this transaction if it doesn't execute within ~5 minutes:
        "maxLedgerVersionOffset": 75
    })
    maxLedgerVersion = preparedTx.instructions.maxLedgerVersion
    console.log("Prepared transaction instructions:", preparedTx.txJSON)
    console.log("Transaction cost:", preparedTx.instructions.fee, "XRP")
    console.log("Transaction expires after ledger:", maxLedgerVersion)
    return preparedTx.txJSON
}

async function sign() {
    var response = api.sign(txJSON, secret)
    txID     = response.id
    // console.log("Identifying hash:", txID)
    txBlob   = response.signedTransaction
    // console.log("Signed blob:", txBlob)
    return txBlob
}

async function doSubmit(txBlob) {
    const latestLedgerVersion = await api.getLedgerVersion()
  
    const result = await api.submit(txBlob)
  
    console.log("Tentative result code:", result.resultCode)
    console.log("Tentative result message:", result.resultMessage)
  
    // Return the earliest ledger index this transaction could appear in
    // as a result of this submission, which is the first one after the
    // validated ledger at time of submission.
    return latestLedgerVersion + 1
}

async function getTransaction() {
    try {
        tx = await api.getTransaction(txID, {minLedgerVersion: earliestLedgerVersion})
        console.log("Transaction result:", tx.outcome.result)
        console.log("Balance changes:", JSON.stringify(tx.outcome.balanceChanges))
    } catch(error) {
        console.log("Couldn't get transaction outcome:", error)
    }
}

async function sendXRP() {
    let wallet = wallet_json[sending_wallet]
    let address = wallet.address
    let amount  = wallet.amount
    let tag  = wallet.tag

    txJSON = await doPrepare(address, amount, tag)
    txBlob = await sign()
    earliestLedgerVersion = await doSubmit(txBlob)
    sending_wallet++

    if (sending_wallet < total_wallet) sendXRP()
}

async function main() {
    total_wallet = wallet_json.length
    if (total_wallet > 0) sendXRP()
}

setTimeout(main, 4000)
