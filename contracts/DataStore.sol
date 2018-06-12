pragma solidity ^0.4.0;
//pragma experimental ABIEncoderV2;

contract DataStore {

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    mapping (address => uint) balances;

    struct Document {
        bytes hash;
        uint id;
        uint ownerIndex;
       // string date;
       // string name;
    }

    address[] public users;
    mapping(bytes => address) allDocs;
    mapping(address => Document[]) public userDocs;

    //save the IPFS hash into a Document struct
    //each user can possess multiple documents
    function addDocForUser(bytes data) public returns (bool success) {
        uint docId;
        uint owner;
        if(userDocs[msg.sender].length == 0) {
            docId = 0;
            owner = users.length;
            userDocs[msg.sender].push(Document(data, docId, owner));
            allDocs[data] = msg.sender;
            users.push(msg.sender);
            return true;
        } else {
            docId = userDocs[msg.sender].length;
            owner = userDocs[msg.sender][0].ownerIndex;

            userDocs[msg.sender].push(Document(data, docId, owner));
            allDocs[data] = msg.sender;
            return true;
        }
        return false;
    }

    //retrieve doc for current user
    function getDocForUser(uint docId) public view returns (bytes) {
        return userDocs[msg.sender][docId].hash;
    }

    //to be used in nested for loop to retrieve all docs
    function getDocByUserIndex(uint ownerid, uint docId) public view returns (bytes) {
        address addr = users[ownerid];
        return userDocs[addr][docId].hash;
    }

    function getNumUsers() public view returns (uint) {
        return users.length;
    }

    function getNumDocsForUser(uint ownerid) public view returns (uint) {
        address addr = users[ownerid];
        return userDocs[addr].length;
    }

    function transferToContract() public payable returns (bool) {
	}

    function transferToUser(uint amount) public returns (bool) {
        msg.sender.transfer(amount);
        return true;
    }

    function getAddressFromDoc(bytes hash) public view returns (address) {
        return allDocs[hash];
    }

}