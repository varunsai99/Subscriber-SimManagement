const { Gateway, Wallets, TxEventHandler, GatewayOptions, DefaultEventHandlerStrategies, TxEventHandlerFactory } = require('fabric-network');
const fs = require('fs');
const EventStrategies = require('fabric-network/lib/impl/event/defaulteventhandlerstrategies');
const path = require("path")
const log4js = require('log4js');
const logger = log4js.getLogger('BasicNetwork');
const util = require('util')

const helper = require('./helper');
const query = require('./query');

const channelName = "mychannel"
const chaincodeName = "fabcar"
var org_name 


const invokeTransaction = async (fcn,username,args) => {
    try {
        org_name = "Org2";
        const ccp = await helper.getCCP(org_name);

        const walletPath = await helper.getWalletPath(org_name);
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        let identity = await wallet.get(username);
        if (!identity) {
            console.log(`An identity for the user ${username} does not exist in the wallet, so registering user`);
            return;
        }

        if(fcn == "SendMoney") {
            let identity2 = await wallet.get(args["to"]);
            if (!identity2) {
                console.log(`An identity for the user ${args["to"]} does not exist in the wallet, so registering user`);
                return;
            }
        }

        const connectOptions = {
            wallet, identity: username, discovery: { enabled: true, asLocalhost: true }
        }

        const gateway = new Gateway();
        await gateway.connect(ccp, connectOptions);

        const network = await gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        let result;
        let err;
        let message;
        let response;

        switch (fcn) {
            case "CreateData":
                console.log(`User name is ${username}`)
                var new_args = {};
                new_args["Name"] = args["Name"];
                new_args["AadharNumber"] = args["AadharNumber"];
                new_args["PhoneNumber"] = args["PhoneNumber"];
                new_args["Status"] = "inactive";
                new_args["Money"] = 0;
                new_args["Doc_type"] = "info";
                console.log(JSON.stringify(new_args));
                result = await contract.submitTransaction('SmartContract:'+fcn, JSON.stringify(new_args));
                result = {txid: result.toString()}
                break;
            
            case "ChangeData":
                console.log(`User name is ${username}`)
                var new_args = {};
                new_args["Name"] = args["Name"];
                new_args["AadharNumber"] = args["AadharNumber"];
                new_args["PhoneNumber"] = username;
                new_args["Doc_type"] = "info";
                console.log(JSON.stringify(new_args));
                await contract.submitTransaction('SmartContract:'+fcn, JSON.stringify(new_args));
                response = {
                    message: "Success",
                }
                return response;
            
            case "BuyService":
                console.log(`User name is ${username}`)
                console.log(`Service name is ${args["Service_name"]}`)
                console.log(`Price is ${args["Price"]}`)
                await contract.submitTransaction('SmartContract:'+fcn,username,args["Service_name"],args["Price"]);
                response = {
                    message: "Success",
                }
                return response;

            case "AddMoney":
                console.log(`User name is ${username}`)
                console.log(`Money is ${args}`)
                await contract.submitTransaction('SmartContract:'+fcn,username,args);
                response = {
                    message: "Success",
                }
                return response;

            case "SendMoney":
                console.log(`User name is ${username}`)
                console.log(`To ${args["to"]}`)
                console.log(`Money is ${args["amount"]}`)
                await contract.submitTransaction('SmartContract:'+fcn,username,args["to"],args["amount"]);
                response = {
                    message: "Success",
                }
                return response;

            default:
                break;
        }

        await gateway.disconnect();

        // result = JSON.parse(result.toString());

        response = {
            message: message,
            result
        }

        return response;


    } catch (error) {

        console.log(`Getting error: ${error}`)
        return error.message

    }
}

exports.invokeTransaction = invokeTransaction;