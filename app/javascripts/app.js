// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract';

import IpfsApi from 'ipfs-api';
import Buffer from 'buffer';
import bs58 from 'bs58';

import datastore_artifacts from '../../build/contracts/DataStore.json';
var DataStore = contract(datastore_artifacts);

var accounts;
var account;
var ipfs;
var ipfsDataHost;
var hashes = new Array(); 

window.App = {
  start: function() {
    var self = this;
    DataStore.setProvider(web3.currentProvider);

    // Get the initial account balance so it can be displayed.
    web3.eth.getAccounts(function(err, accs) {
      if (err != null) {
        alert("There was an error fetching your accounts.");
        return;
      }

      if (accs.length == 0) {
        alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
        return;
      }

      accounts = accs;
      account = accounts[0];

    });

    // IPFS
    var ipfsHost = 'localhost',
    ipfsAPIPort = '5001',
    ipfsWebPort = '8082';
    ipfs = IpfsApi('localhost', '5001', {protocol: 'http'});
    ipfs.swarm.peers(function(err, response) {
      if (err) {
          console.error(err);
      } else {
          console.log("IPFS - connected to " + response.length + " peers");
      }
    });
    ipfsDataHost = "http://" + ipfsHost + ':' + ipfsWebPort + "/ipfs";
    window.ipfs = ipfs
  },

  loadFile: function(event) {
    var self = this;
    var gotFile = event.target;
    var reader = new FileReader();
    reader.onload = function(event) {
      var id = document.getElementById("file");
      if(id.files && id.files[0]) {
        var filename = id.files[0]['name']
       // console.log('Data - ' + decode_base64(reader.result.substr(13)))
        var bufferData = Buffer.Buffer.from(event.target.result);
        var d = new Date();
        self.addToIpfs(bufferData, d);
      }
    };
    reader.readAsText(gotFile.files[0]);  
  },

  addToIpfs: function(data, currdate) {
    var self = this;
    var savedHash;
    var datastore;

    ipfs.files.add(data).then(res => {
      return res[0].hash;
    }).then(function(res) {
      DataStore.deployed().then(function(instance) {
        datastore = instance;
        var converted = self.ipfsHashToBytes32(res);  
        return datastore.addDocForUser(converted, {from: account}); 
      }).then(function() {
        console.log("Transaction complete!");
      }).catch(function(e) {
        console.log(e);
        console.log("Could not record transaction");
      });      
    }).catch(err => {
      console.log(err);
      console.log("Could not add to IPFS");
    });

    
  },

  getFromIpfs1: function() {
    var self = this;
    var datastore;

    var docRow = $('#docRow');
    docRow.empty();

    DataStore.deployed().then(function(instance) {
      datastore = instance;
      return datastore.getDocForUser(0, {from: account});
      //console.log(`from BC ${recData[0].content.toString('utf8')}`);
    }).then(function(res) {
        console.log(`data: ${res}`);
        
        ipfs.files.get(self.bytes32ToIPFSHash(res)).then(res => {
          var outputString = res[0].content.toString('utf8');
          var truncatedString = outputString.substring(0, 150);

          var docTemplate = $('#docTemplate');
          docTemplate.find('#panel-content').text(outputString);
          docRow.append(docTemplate.html());

        }).catch(err => {
          console.log(err);
        });
    }).catch(function(e) {
      console.log(e);
      console.log("Could not get data");
    });

  },

  getFromIpfs2: function() {
    var self = this;
    var datastore;

    var docRow = $('#docRow');
    docRow.empty();

    DataStore.deployed().then(function(instance) {
      datastore = instance;
      return datastore.getNumUsers(0, {from: account});
    }).then(async function(res) {
      var numUsers = res;

      for (let i = 0; i < numUsers; i ++) {
         datastore.getNumDocsForUser(i, {from: account})
        .then(function(res) {
          for (let j = 0; j < res; j ++) {
            datastore.getDocByUserIndex(i, j, {from: account})
            .then(function(res) {
              var byteHash = res;
              var convertedHash = self.bytes32ToIPFSHash(res);
              hashes.push(res);

              ipfs.files.get(convertedHash).then(res => {
                var outputString = res[0].content.toString('utf8');
                var truncatedString = outputString.substring(0, 150);

                var docTemplate = $('#docTemplate');
                docTemplate.find('#panel-content').text(outputString);
                docTemplate.find('#give-coin').attr('data-hash', byteHash);
                docRow.append(docTemplate.html());

              }).catch(err => {
                console.log(err);
              });
            }).catch(function(e) {
              console.log(e);
              console.log("Could not get data");
            });
          }
        }).catch(function(e) {
          console.log(e);
          console.log("Could not get data");
        });
      }
      return hashes;
    }).catch(function(e) {
      console.log(e);
      console.log("Could not get data");
    });

  },

  returnHash: function() {
    console.log(hashes);
  },

  giveCoin: function(event) {
    var hash = $(event.target).data('hash');
    var self = this;
    var datastore;

    var handleReceipt = (error, receipt) => {
      if (error) console.error(error);
      else {
        console.log(receipt);
       // res.json(receipt);
      }
    }

    DataStore.deployed().then(function(instance) {
        datastore = instance;
        //datastore.transferToContract({from: account, value: 10**18}); 
        return datastore.getAddressFromDoc(String(hash));
      }).then(function(res) {
        web3.eth.sendTransaction({ from: account, to: res, value: 10**18 },
          handleReceipt);
        //return datastore.transferToUser(10**18, {from: res});
      }).catch(function(e) {
        console.log(e);
        console.log("Could not record transaction");
      });      
  },

  ipfsHashToBytes32: function(ipfs_hash) {
    var h = bs58.decode(ipfs_hash).toString('hex').replace(/^1220/, '');
    if (h.length != 64) {
        console.log('invalid ipfs format', ipfs_hash, h);
        return null;
    }
    return '0x' + h;
  },

  bytes32ToIPFSHash: function(hash_hex) {
    //console.log('bytes32ToIPFSHash starts with hash_buffer', hash_hex.replace(/^0x/, ''));
    var buf = Buffer.Buffer.from(hash_hex.replace(/^0x/, '1220'), 'hex')
    return bs58.encode(buf)
  }

};

window.addEventListener('load', function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://127.0.0.1:7545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));
  }
  App.start();
  //var d = new Date();
  //console.log(d.getUTCDate());
  //console.log(d.getTimezoneOffset());
  //console.log(d);
});
