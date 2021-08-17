package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
	"time"
	"encoding/base64"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
	"github.com/hyperledger/fabric/common/flogging"
)

type SmartContract struct {
	contractapi.Contract
}

var logger = flogging.MustGetLogger("fabcar_cc")

type TelcoData struct{
	AadharNumber string `json:"AadharNumber"`
	Name   string `json:"Name"`
	PhoneNumber  string `json:"PhoneNumber"`
	Status   string `json:"Status"`
	Money float64 `json:"Money"`
	Doc_type string `json:"Doc_type"`
}

type ServiceData struct{
	PhoneNumber string `json:"PhoneNumber"`
	ServiceName   string `json:"ServiceName"`
	ServicePrice float64 `json:"ServicePrice"`
	UserName  string `json:"UserName"`
	// ExpiryDate time.Time `json:"ExpiryDate"`
	Doc_type string `json:"Doc_type"`
}

type TransactionData struct{
	UserName  string `json:"UserName"`
	From string `json:"From"`
	To   string `json:"To"`
	Amount  float64 `json:"Amount"`
	Type string `json:"Type"`
	Doc_type string `json:"Doc_type"`
}


func (s *SmartContract) CreateData(ctx contractapi.TransactionContextInterface, Data string) (string, error) {
	if len(Data) == 0 {
		return "", fmt.Errorf("Please pass the correct data")
	}
	var data TelcoData
	err := json.Unmarshal([]byte(Data), &data)
	if err != nil {
		return "", fmt.Errorf("Failed while unmarshling Data. %s", err.Error())
	}

	dataAsBytes, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}

	ctx.GetStub().SetEvent("CreateAsset", dataAsBytes)

	return ctx.GetStub().GetTxID(), ctx.GetStub().PutState(data.PhoneNumber, dataAsBytes)
}

func (s *SmartContract) ChangeData(ctx contractapi.TransactionContextInterface, Data string) error {
	if len(Data) == 0 {
		return fmt.Errorf("Please pass the correct data")
	}

	var newdata TelcoData
	err := json.Unmarshal([]byte(Data), &newdata)
	if err != nil {
		return fmt.Errorf("Failed while unmarshling Data. %s", err.Error())
	}

	data,err := s.ReadAsset(ctx,newdata.PhoneNumber)
	if err!=nil{
		return fmt.Errorf("Problem while reading the data.")
	}
	data.AadharNumber = newdata.AadharNumber
	data.Name = newdata.Name;

	dataAsBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}

	return ctx.GetStub().PutState(data.PhoneNumber, dataAsBytes)
}

func (s *SmartContract) AddMoney(ctx contractapi.TransactionContextInterface, Id string,amount int64) error {
	if len(Id) == 0 {
		return fmt.Errorf("Please pass the correct data")
	}
	asset,err := s.ReadAsset(ctx,Id);
	if err!=nil{
		return fmt.Errorf("Problem while reading the data.")
	}
	asset.Money = asset.Money + amount
	asset.Status = "Active"

	dataAsBytes, err := json.Marshal(asset)
	if err != nil {
		return fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}

	err = ctx.GetStub().PutState(asset.PhoneNumber, dataAsBytes)
	if err != nil {
		return err
	}

	data := &TransactionData{
		UserName: Id+"_transaction",
		From:Id,
		To:Id,
		Amount:amount,
		Type:"Self",
		Doc_type: "transaction",
	}

	transAsBytes, err := json.Marshal(data)

	if err != nil {
		return fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}
	return ctx.GetStub().PutState(data.UserName, transAsBytes)
}

func (s *SmartContract) SendMoney(ctx contractapi.TransactionContextInterface, Id1 string,Id2 string,amount int64) error {
	if len(Id1) == 0 || len(Id2) == 0{
		return fmt.Errorf("Please pass the correct data")
	}
	asset1,err := s.ReadAsset(ctx,Id1);
	if err!=nil{
		return fmt.Errorf("Problem while reading the data.")
	}
	if asset1.Money < amount {
		return fmt.Errorf("Insufficient amount in wallet.")
	}

	asset2,err := s.ReadAsset(ctx,Id2);
	if err!=nil{
		return fmt.Errorf("Problem while reading the data.")
	}
	asset1.Money = asset1.Money - amount
	asset2.Money = asset2.Money + amount
	asset2.Status = "Active"

	dataAsBytes, err := json.Marshal(asset1)
	if err != nil {
		return fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}

	err = ctx.GetStub().PutState(asset1.PhoneNumber, dataAsBytes)
	if err != nil {
		return err
	}

	dataAsBytes1, err := json.Marshal(asset2)
	if err != nil {
		asset1.Money = asset1.Money + amount

		dataAsBytes3, err := json.Marshal(asset1)
		if err != nil {
			return fmt.Errorf("Failed while marshling Data. %s", err.Error())
		}

		err = ctx.GetStub().PutState(asset1.PhoneNumber, dataAsBytes3)
		if err != nil {
			return err
		}
		return fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}

	err = ctx.GetStub().PutState(asset2.PhoneNumber, dataAsBytes1)
	if err != nil {
		return err
	}

	data1 := &TransactionData{
		UserName: asset1.PhoneNumber+"_transaction",
		From:asset1.PhoneNumber,
		To:asset2.PhoneNumber,
		Amount:amount,
		Type:"Debit",
		Doc_type: "transaction",
	}

	transAsBytes1, err := json.Marshal(data1)

	if err != nil {
		return fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}

	err = ctx.GetStub().PutState(data1.UserName, transAsBytes1)
	if err != nil {
		return err
	}

	data2 := &TransactionData{
		UserName: asset2.PhoneNumber+"_transaction",
		From:asset2.PhoneNumber,
		To:asset1.PhoneNumber,
		Amount:amount,
		Type:"Credit",
		Doc_type: "transaction",
	}

	transAsBytes2, err := json.Marshal(data2)

	if err != nil {
		return fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}
	return ctx.GetStub().PutState(data2.UserName, transAsBytes2)
}

func (s *SmartContract) BuyService(ctx contractapi.TransactionContextInterface, username string,servicename string,price string,days int64) error {
	if len(username) == 0 {
		return fmt.Errorf("Please pass the correct data.")
	}
	Price, err := strconv.ParseInt(price, 10, 64)
	if err!=nil{
		return fmt.Errorf("Please price of product correctly.")
	}

	asset,err := s.ReadAsset(ctx,username);
	if err!=nil{
		return fmt.Errorf("Problem while reading the data.")
	}
	if asset.Money < Price {
		return fmt.Errorf("Insufficient amount in wallet.")
	}

	data := &ServiceData{
		PhoneNumber:username,
		ServiceName:servicename,
		UserName: username+"_service",
		ServicePrice:Price,
		Doc_type: "service",
	}
	
	dataAsBytes, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}

	ctx.GetStub().SetEvent("CreateAsset", dataAsBytes)

	err = ctx.GetStub().PutState(data.UserName, dataAsBytes)
	if err != nil {
		return fmt.Errorf("Failed while pushing the transaction.")
	}

	asset.Money = asset.Money - Price;
	asset.Status = "Active"

	dataAsBytes1, err := json.Marshal(asset)
	if err != nil {
		return fmt.Errorf("Failed while marshling Data. %s", err.Error())
	}
	
	return ctx.GetStub().PutState(asset.PhoneNumber, dataAsBytes1)
}

func (s *SmartContract) ReadAsset(ctx contractapi.TransactionContextInterface, ID string) (*TelcoData, error) {
	if len(ID) == 0 {
		return nil, fmt.Errorf("Please provide correct contract Id")
	}
	dataAsBytes, err := ctx.GetStub().GetState(ID)

	if err != nil {
		return nil, fmt.Errorf("Failed to read from world state. %s", err.Error())
	}

	if dataAsBytes == nil {
		return nil, fmt.Errorf("%s does not exist", ID)
	}
	data := new(TelcoData)
	_ = json.Unmarshal(dataAsBytes, data)

	return data, nil
}

func (s *SmartContract) GetDataByPhoneNumber(ctx contractapi.TransactionContextInterface, ID string) (*TelcoData, error) {
	if len(ID) == 0 {
		return nil, fmt.Errorf("Please provide correct contract Id")
	}

	clientID,err := s.GetSubmittingClientIdentity(ctx)
	if err!= nil {
		return nil, fmt.Errorf("Failed to read client Identity %s", err.Error())
	}
	err = ctx.GetClientIdentity().AssertAttributeValue("usertype", "telco-admin")

	if clientID != ID && err == nil {
		return nil, fmt.Errorf("Doesnt have permission to access %s", err.Error())		
	}

	dataAsBytes, err := ctx.GetStub().GetState(ID)

	if err != nil {
		return nil, fmt.Errorf("Failed to read from world state. %s", err.Error())
	}

	if dataAsBytes == nil {
		return nil, fmt.Errorf("%s does not exist", ID)
	}

	data := new(TelcoData)
	_ = json.Unmarshal(dataAsBytes, data)

	return data, nil
}

func (s *SmartContract) GetServiceDataByPhoneNumber(ctx contractapi.TransactionContextInterface, ID string) (*ServiceData, error) {
	if len(ID) == 0 {
		return nil, fmt.Errorf("Please provide correct contract Id")
	}

	clientID,err := s.GetSubmittingClientIdentity(ctx)
	if err!= nil {
		return nil, fmt.Errorf("Failed to read client Identity %s", err.Error())
	}
	err = ctx.GetClientIdentity().AssertAttributeValue("usertype", "telco-admin")

	if clientID != ID && err == nil {
		return nil, fmt.Errorf("Doesnt have permission to access %s", err.Error())		
	}

	dataAsBytes, err := ctx.GetStub().GetState(ID)

	if err != nil {
		return nil, fmt.Errorf("Failed to read from world state. %s", err.Error())
	}

	if dataAsBytes == nil {
		return nil, fmt.Errorf("%s does not exist", ID)
	}

	data := new(ServiceData)
	_ = json.Unmarshal(dataAsBytes, data)

	return data, nil
}


func (s *SmartContract) GetHistoryForAsset(ctx contractapi.TransactionContextInterface, ID string) (string, error) {

	resultsIterator, err := ctx.GetStub().GetHistoryForKey(ID)
	if err != nil {
		return "", fmt.Errorf(err.Error())
	}
	defer resultsIterator.Close()

	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return "", fmt.Errorf(err.Error())
		}
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"TxId\":")
		buffer.WriteString("\"")
		buffer.WriteString(response.TxId)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Value\":")
		if response.IsDelete {
			buffer.WriteString("null")
		} else {
			buffer.WriteString(string(response.Value))
		}

		buffer.WriteString(", \"Timestamp\":")
		buffer.WriteString("\"")
		buffer.WriteString(time.Unix(response.Timestamp.Seconds, int64(response.Timestamp.Nanos)).String())
		buffer.WriteString("\"")

		buffer.WriteString(", \"IsDelete\":")
		buffer.WriteString("\"")
		buffer.WriteString(strconv.FormatBool(response.IsDelete))
		buffer.WriteString("\"")

		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	return string(buffer.Bytes()), nil
}

func (s *SmartContract) DeleteDataById(ctx contractapi.TransactionContextInterface, ID string) (string, error) {
	if len(ID) == 0 {
		return "", fmt.Errorf("Please provide correct contract Id")
	}

	return ctx.GetStub().GetTxID(), ctx.GetStub().DelState(ID)
}

func (s *SmartContract) GetSubmittingClientIdentity(ctx contractapi.TransactionContextInterface) (string, error) {
	// x509::CN=telco-admin,OU=o 
	b64ID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("Failed to read clientID: %v", err)
	}
	decodeID, err := base64.StdEncoding.DecodeString(b64ID)
	if err != nil {
		return "", fmt.Errorf("failed to base64 decode clientID: %v", err)
	}
	res := string(decodeID)
	i:=0
	id:=""
	for ;i<len(res);i++{
		if res[i] == '='{
			break	
		}
	}
	for i=i+1;i<len(res);i++{
		if res[i] == ','{
			break	
		} 
		id += string(res[i])
	} 
	return id, nil
}


func (s *SmartContract) getQueryResultData(ctx contractapi.TransactionContextInterface, queryString string) ([]TelcoData, error) {
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()
	
	results := []TelcoData{}

	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		newData := new(TelcoData)
		
		fmt.Print("Responce is ",response.Value,"\n")
		err = json.Unmarshal(response.Value, newData)
		if err == nil {
			results = append(results, *newData)
		}
	}
	return results, nil
}

func (s *SmartContract) QueryAllData(ctx contractapi.TransactionContextInterface, queryString string) ([]TelcoData, error) {
	err := ctx.GetClientIdentity().AssertAttributeValue("usertype", "telco-admin")
	if err != nil {
		return nil,fmt.Errorf("submitting client not authorized to perform this task.")
	}

	return s.getQueryResultData(ctx,queryString)
}

func (s *SmartContract) getQueryResultService(ctx contractapi.TransactionContextInterface, queryString string) ([]ServiceData, error) {

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()
	
	results := []ServiceData{}

	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		newData := new(ServiceData)
		
		fmt.Print("Responce is ",response.Value,"\n")
		err = json.Unmarshal(response.Value, newData)
		if err == nil {
			results = append(results, *newData)
		}
	}
	return results, nil
}

func (s *SmartContract) QueryAllServices(ctx contractapi.TransactionContextInterface, queryString string) ([]ServiceData, error) {
	err := ctx.GetClientIdentity().AssertAttributeValue("usertype", "telco-admin")
	if err != nil {
		return nil,fmt.Errorf("submitting client not authorized to perform this task.")
	}

	return s.getQueryResultService(ctx,queryString)
}

func (s *SmartContract) getQueryResultForTransaction(ctx contractapi.TransactionContextInterface, queryString string) ([]TransactionData, error) {
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()
	
	results := []TransactionData{}

	for resultsIterator.HasNext() {
		response, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}
		newData := new(TransactionData)
		
		fmt.Print("Responce is ",response.Value,"\n")
		err = json.Unmarshal(response.Value, newData)
		if err == nil {
			results = append(results, *newData)
		}
	}
	return results, nil
}

func (s *SmartContract) QueryAllTransactions(ctx contractapi.TransactionContextInterface, queryString string) ([]TransactionData, error) {
	err := ctx.GetClientIdentity().AssertAttributeValue("usertype", "telco-admin")
	if err != nil {
		return nil,fmt.Errorf("submitting client not authorized to perform this task.")
	}

	return s.getQueryResultForTransaction(ctx,queryString)
}


func main() {

	chaincode, err := contractapi.NewChaincode(new(SmartContract))
	if err != nil {
		fmt.Printf("Error create fabcar chaincode: %s", err.Error())
		return
	}
	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting chaincodes: %s", err.Error())
	}

}
