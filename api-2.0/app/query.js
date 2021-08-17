const { Gateway, Wallets, } = require('fabric-network');
const fs = require('fs');
const path = require("path")
const log4js = require('log4js');
const logger = log4js.getLogger('BasicNetwork');
const util = require('util')
const channelName = "mychannel"
const chaincodeName = "fabcar"

const helper = require('./helper')

const query = async (args, fcn, username, org_name) => {
    try {
        const ccp = await helper.getCCP(org_name);

        const walletPath = await helper.getWalletPath(org_name);
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        let identity = await wallet.get(username);
        if (!identity) {
            console.log(`An identity for the user ${username} does not exist in the wallet`);
            return;
        }

        const connectOptions = {
            wallet, identity: username, discovery: { enabled: true, asLocalhost: true }
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, connectOptions);

        const network = await gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);
        
        let result;
        switch (fcn) {
            case "GetHistoryForAsset":
            case "GetDataByPhoneNumber":
            case "GetServiceDataByPhoneNumber":
                console.log("=============")
                result = await contract.evaluateTransaction('SmartContract:'+fcn, args);
                break;

            case "QueryAllData": 
                var query_string = {"selector":{"Doc_type":"info"}}
                result = await contract.evaluateTransaction('SmartContract:'+fcn, JSON.stringify(query_string));
                break;

            case "QueryAllServices": 
                var query_string = {"selector":{"Doc_type":"service"}}
                result = await contract.evaluateTransaction('SmartContract:'+fcn, JSON.stringify(query_string));
                break;    
            
            case "QueryAllTransactions": 
                var query_string = {"selector":{"Doc_type":"transaction"}}
                result = await contract.evaluateTransaction('SmartContract:'+fcn, JSON.stringify(query_string));
                break;

            case "GetSubmittingClientIdentity":
                result = await contract.evaluateTransaction('SmartContract:'+fcn);
                console.log(`Transaction has been evaluated, result is: ${result.toString()}`);
                return result;
            default:
                break;
        }
        // console.log(result)
        console.log(`Transaction has been evaluated, result is: ${result.toString()}`);

        result = JSON.parse(result.toString());
        return result
    } catch (error) {
        console.error(`Failed to evaluate transaction: ${error}`);
        return error.message

    }
}

exports.query = query