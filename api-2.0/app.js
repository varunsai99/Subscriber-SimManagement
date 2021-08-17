'use strict';
const log4js = require('log4js');
const logger = log4js.getLogger('BasicNetwork');
const bodyParser = require('body-parser');
const http = require('http')
const util = require('util');
var SHA256 = require("crypto-js/sha256");
const mongoose = require('mongoose')
const express = require('express')
const app = express();
const dbURI = 'mongodb+srv://varun:varun1234@telco-project.rf8w0.mongodb.net/Project?retryWrites=true&w=majority'

const cors = require('cors');
const constants = require('./config/constants.json')

const host = process.env.HOST || constants.host;
const port = process.env.PORT || constants.port;

const helper = require('./app/helper')
const invoke = require('./app/invoke')
const query = require('./app/query')
const PasswordHash = require('./models/schema_pass');
const Customer_Data = require('./models/schema_data');
const Aadhar_Data = require('./models/schema_aadhar');
const { url } = require('inspector');
const channelName = "mychannel"
const chaincodeName = "fabcar"

mongoose.connect(dbURI,{useNewUrlParser:true,useUnifiedTopology:true})
    .then((result) => {
        var server = http.createServer(app).listen(port, function () { console.log(`Server started on ${port}`) });
        logger.info('****************** SERVER STARTED AND DATABASE INITIATED ************************');
        logger.info('***************  http://%s:%s  ******************', host, port);
        server.timeout = 240000;
    })
    .catch((err) => console.log(err));


app.use(express.static('public'));
app.use("/css",express.static(__dirname+'public/css'))

app.set('views','./views');
app.set('view engine', 'ejs');

app.options('*', cors());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

logger.level = 'debug';

function getErrorMessage(field) {
    var response = {
        success: false,
        message: field + ' field is missing or Invalid in the request'
    };
    return response;
}

app.get('/', async function(req,res){
    res.render('index',{title:'Home'})
});

app.get('/register',async function (req, res) {
    res.render('register_admin',{title:"Register"})
});

// Register and enroll user
app.post('/register', async function (req, res) {
    var username = req.body.username;
    var password = req.body.password;
    var usertype = req.body.usertype;
    var orgName = helper.getOrg(usertype)
    logger.debug('End point : /register');
    logger.debug('User name : ' + username);
    logger.debug('Password  : ' + password);
    logger.debug('Usertype  : ' + usertype);
    if (!username) {
        res.json(getErrorMessage('\'username\''));
        return;
    }
    if (!password) {
        res.json(getErrorMessage('\'password\''));
        return;
    }
    if (!usertype) {
        res.json(getErrorMessage('\'usertype\''));
        return;
    }
    
    let response = await helper.Register(username, password,usertype);

    logger.debug('-- returned from registering the username %s for organization %s', username, orgName);
    if (response && typeof response !== 'string') {
        logger.debug('Successfully registered the username %s for organization %s', username, orgName);
        var pass_hash = SHA256(username+password+usertype)
        pass_hash = JSON.stringify(pass_hash["words"]);
        console.log(pass_hash);
        const pw_data = new PasswordHash({
            username:username,
            password_hash:pass_hash
        });
        pw_data.save().then((result) => {
            console.log(result);
            res.render('success',{username:username,title:"success"});
        }).catch((err) => {
            console.log(err);
            res.render('failure',{username:username,title:"failed"});
        });
        
    } else {
        logger.debug('Failed to register the username %s for organization %s with::%s', username, orgName, response);
        res.render('failure',{username:username,title:"failed"})
    }

});

// Login 
app.get('/Adminlogin', async function (req, res) {
    res.render('Login',{title:"Admin Login"})
});

app.post('/Adminlogin', async function (req, res) {
    try{
        var username = req.body.username;
        const user_present = await helper.isUserRegistered(username,"Org1")
        console.log(user_present);
        if(!user_present) 
        {
            console.log(`An identity for the user ${username} not exists`);
            var response = {
                success: false,
                message: username + ' was not enrolled',
            };
            return response
        }
        var password = req.body.password;
        var usertype = req.body.usertype;
        var orgName = helper.getOrg(usertype);
        logger.debug('End point : /login');
        logger.debug('User name : ' + username);
        logger.debug('Password  : ' + password);
        if (!username) {
            res.json(getErrorMessage('\'username\''));
            return;
        }
        if (!password) {
            res.json(getErrorMessage('\'Password\''));
            return;
        }
        var pass_hash = SHA256(username+password+usertype)
        PasswordHash.findOne({"username":username},async(err,data)=>{
            if(err)
            {
                res.send(err);
                return;
            }
            else{
                console.log(JSON.stringify(data["password_hash"]));
                console.log(JSON.stringify(pass_hash["words"]));
                if(data["password_hash"] === JSON.stringify(pass_hash["words"]))
                {
                   if(usertype == "telco-admin") {
                        var url_resp = "/admin/"+username;
                        res.redirect(url_resp)
                   }
                   else{
                        var url_resp = "/dealer/"+username;
                        res.redirect(url_resp)
                   }
                }
                else{
                    const response_payload = {
                        result: null,
                        error: "Invalid Credentials"
                    }
                    res.send(response_payload)
                }
            }
        });
    }
    catch (error) {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }
});

app.get('/admin/:username',async function(req,res){
    var username = req.params.username;
    res.render('telco_admin_page',{title:"Admin",username})
});

app.get('/admin/:username/GetCustomerByPhoneNumber', async function (req, res) {
    res.render('GetCustomerByNumber',{title:"Get Data"})
});


app.post('/admin/:username/GetCustomerByPhoneNumber', async function (req, res) {
    try {        
        let number = req.body.number;
        let username = req.params.username
        res.redirect(`/admin/${username}/GetCustomerByPhoneNumber/${number}`)

    } catch (error) {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }
});




app.get('/admin/:username/GetCustomerByPhoneNumber/:number', async function (req, res) {
    let username = req.params.username;
    let number = req.params.number;
    res.render('number_queries',{title:"Get Data",username,number});
});

app.get('/admin/:username/GetCustomerByPhoneNumber/:number/info', async function (req, res) {
    let username = req.params.username;
    let number = req.params.number;
    let message = await query.query(number,"GetDataByPhoneNumber",number,"Org2");
    
    res.render('display',{title:"Info",message})
});

app.get('/admin/:username/GetCustomerByPhoneNumber/:number/services', async function (req, res) {
    let username = req.params.username;
    let number = req.params.number;
    let message = await query.query(number+"_service","GetHistoryForAsset",number,"Org2");
    res.render('display_all_services',{title:"Service Data",message})
});

app.get('/admin/:username/GetCustomerByPhoneNumber/:number/transactions', async function (req, res) {
    let username = req.params.username;
    let number = req.params.number;
    let message = await query.query(number+"_transaction","GetHistoryForAsset",number,"Org2");
    res.render('display_all_transactions',{title:"Transaction Data",message})
});


app.get('/admin/:username/GetAllCustomers', async function (req, res) {
    try {        
        let username = req.params.username
        let message = await query.query(null,"QueryAllData",username,"Org1");

        res.render('display_all',{title:"All Details",username,message});

    } catch (error) {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }
});



app.get('/dealer/:dealername',function(req,res){
    res.render('dealer_page',{title:"Dealer Page"})
});


app.post('/dealer/:dealername' ,async function (req,res){
    try{
        var dealername = req.params.dealername;
        var password = req.body.password;
        var args = {};
        args["AadharNumber"] = req.body.AadharNumber;
        args["Address"] = req.body.Address;
        args["DateOfBirth"] = req.body.DateOfBirth;
        args["Name"] = req.body.Name;
        args["AltenativeNumber"] = req.body.AltenativeNumber;
        args["PhoneNumber"] = req.body.PhoneNumber;
        args["Gender"] = req.body.Gender;
        var username = req.body.PhoneNumber;

        console.log(req.body.AadharNumber);
        console.log(req.body.Address);
        console.log(req.body.DateOfBirth);
        console.log(req.body.Name);
        console.log(req.body.Gender);

        var actual_data;
        Aadhar_Data.findOne({"AadharNumber":args["AadharNumber"]},async (err,data)=>{
            if(err){
                console.log(err);
            }
            else{
                actual_data = data;
                console.log(`Actual data is ${actual_data}`)
                if(!actual_data)
                {
                    result = "Aadhar data doesnt exist in server";
                    const response_payload = {
                        result: result,
                        error: error.name,
                        errorData: error.message
                    }
                    res.send(response_payload)
                }
                console.log("Aadhar data present in the Database.")
                const valid = await helper.ValidateAadhar(actual_data,args);
                console.log(valid);
                if(!valid)
                {
                    result = "Data provided is not matched by actual data.";
                    const response_payload = {
                        result: result,
                        error: error.name,
                        errorData: error.message
                    }
                    res.send(response_payload)
                }
                console.log("Aadhar data matched.")
                let response = await helper.Register(args["PhoneNumber"], password,"customer");
                
                console.log("User created...")

                let message = await invoke.invokeTransaction("CreateData",args["PhoneNumber"],args);
                console.log(message);
                console.log(`message result is : ${message}`)

                var pass_hash = SHA256(username+password+"customer")
                pass_hash = JSON.stringify(pass_hash["words"]);
                console.log(pass_hash);
                const pw_data = new PasswordHash({
                    username:username,
                    password_hash:pass_hash
                });
                pw_data.save().then((result) => {
                    console.log(result);
                }).catch((err) => {
                    console.log(err);
                });

                const cust_data = new Customer_Data({
                    Name:args["Name"],
                    Address:args["Address"],
                    AadharNumber:args["AadharNumber"],
                    DateOfBirth:args["DateOfBirth"],
                    Gender:args["Gender"],
                    PhoneNumber:username
                });
                cust_data.save().then((result) => {
                    console.log(result);
                }).catch((err) => {
                    console.log(err);
                });

                res.redirect(`/dealer/${dealername}`);
            }
        });
    }
    catch(error)
    {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }
});

app.get('/Userlogin', async function (req, res) {
    res.render('userLogin',{title:"User Login"})
});

app.post('/Userlogin', async function (req, res) {
    var username = req.body.username;

    const user_present = await helper.isUserRegistered(username,"Org2")
    if(!user_present) 
    {
        console.log(`An identity for the user ${username} not exists`);
        var response = {
            success: false,
            message: username + ' was not enrolled',
        };
        return response
    }
    var password = req.body.password;
    var usertype = "customer";
    var orgName = helper.getOrg(usertype);
    logger.debug('End point : /login');
    logger.debug('User name : ' + username);
    logger.debug('Password  : ' + password);
    if (!username) {
        res.json(getErrorMessage('\'username\''));
        return;
    }
    if (!password) {
        res.json(getErrorMessage('\'Password\''));
        return;
    }
    var pass_hash = SHA256(username+password+usertype)
    PasswordHash.findOne({"username":username},async (err,data)=>{
        if(err)
        {
            console.log(err);
        }
        else{
            if(data["password_hash"] === JSON.stringify(pass_hash["words"]))
            {
                var url_new = '/user/'+username
                res.redirect(url_new);
            }
            else{
                res.send({success: false, message: "Invalid Credentials" });
            }
        }
    });
});

app.get('/user/:username' ,async function (req,res){
    var number = req.params.username;
    res.render('user_page',{title:"User",number})
});

app.get('/user/:username/AddMoney' ,async function (req,res){
    res.render('addMoney',{title:"Add Money"})
});

app.post('/user/:username/AddMoney' ,async function (req,res){
    try{
        var money = req.body.money;
        var username = req.params.username;
        await invoke.invokeTransaction("AddMoney",username,money);
        res.redirect(`/user/${username}`)
    }
    catch(error)
    {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }
});

app.get('/user/:username/sendMoney' ,async function (req,res){
    var username = req.params.username;
    res.render('send_money',{title:"Send Money",username})
});

app.post('/user/:username/sendMoney' ,async function (req,res){
    try{
        var username = req.params.username;
        var args = {};
        args["to"] = req.body.to;
        args["amount"] = req.body.money;
        console.log(args["to"]);
        console.log(args["amount"]);
        await invoke.invokeTransaction("SendMoney",username,args);
        res.redirect(`/user/${username}`);
    }
    catch(error)
    {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }
});

app.get('/user/:username/details' ,async function (req,res){
    var username = req.params.username;
    let message = await query.query(username, "GetDataByPhoneNumber",username,"Org2");
    res.render('display',{title:"Services",message})
});


app.get('/user/:username/services' ,async function (req,res){
    var username = req.params.username;
    res.render('services',{title:"Services",username})
});


app.get('/user/:username/currentplan' ,async function (req,res){
    res.render('currentplan',{title:"Current Plan"})
});


app.get('/user/:username/transactions' ,async function (req,res){
    var username = req.params.username;
    res.render('transactions',{title:"Transactions",username});
});

app.get('/user/:username/transactions/services' ,async function (req,res){
    var username = req.params.username;
    let message = await query.query(username+"_service","GetHistoryForAsset",username,"Org2");
    res.render('display_all_services',{title:"Services",message});
});

app.get('/user/:username/transactions/payments' ,async function (req,res){
    var username = req.params.username;
    let message = await query.query(username+"_transaction","GetHistoryForAsset",username,"Org2");
    res.render('display_all_transactions',{title:"Transactions",message});
});

app.post('/user/:userid/services/BuyService' ,async function (req,res){
    try{
        var username = req.params.userid;
        var args = {};
        args["Service_name"] = req.body.service_name;
        args["Price"] = req.body.price;
        // args["days"] = parseInt(req.body.validity);
        console.log(req.body.service_name);
        console.log(req.body.price);
        console.log(`Input is ${args}`)
        let message = await invoke.invokeTransaction("BuyService",username,args);
        console.log(message);
        if(message){
            res.redirect(`/user/${username}`)
        }
        else{
            const response_payload = {
                result: "The Transaction Failed.",
            }
            res.send(response_payload)
        }
        
    }
    catch(error)
    {
        const response_payload = {
            result: "The Transaction Failed. Please check the wallet ammount before purchasing the service",
        }
        res.send(response_payload)
    }
});


app.get('/admin/:username/GetIdentity', async function (req, res) {
    try{
        let username = req.params.username
        let message = await query.query(null, "GetSubmittingClientIdentity",username,"Org1");
        const response_payload = {
            result: message,
            error: null,
            errorData: null
        }

        res.send(response_payload);
    }
    catch (error) {
        const response_payload = {
            result: null,
            error: error.name,
            errorData: error.message
        }
        res.send(response_payload)
    }
});