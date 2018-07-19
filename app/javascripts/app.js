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
//var hashes = new Array();
//var titles = new Array();

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

  loadFile: function() {
    var self = this;
    var reader = new FileReader();
    var fileInput = $('#file');
    var titleInput = $('#title');

    //Define event handler
    reader.onload = function(evt) {
      if(evt) {
        var bufferData = Buffer.Buffer.from(evt.target.result);
        var d = new Date().toString();
        self.addToIpfs(bufferData, d, titleInput[0].value);
      }
    };
    reader.readAsArrayBuffer(fileInput[0].files[0]);  
    fileInput.val('');
  },

  addToIpfs: function(data, currdate, title) {
    var self = this;
    var savedHash;
    var datastore;
    var fileInput = $('#file');
    var status = $('#status');

    ipfs.files.add(data).then(res => {
      return res[0].hash;
    }).then(function(res) {
      DataStore.deployed().then(function(instance) {
        datastore = instance;
        //Convert to appropriate type for smart contract
        var converted = self.ipfsHashToBytes32(res);  

        //Create the Document struct and add it to user 
        return datastore.addDocForUser(converted, title, currdate, {from: account}); 
      }).then(function() {
        fileInput.val('');
        status.text("File uploaded!");
        self.getFromIpfs();
        console.log("Transaction complete!");
      }).catch(function(e) {
        console.log(e);
        console.log("Could not record transaction");
      });      
    }).catch(function(e) {
      console.log(e);
      console.log("Could not add to IPFS");
    });
  },

  getFromIpfs: function() {
    var self = this;
    var datastore;
    var account;
    web3.eth.getAccounts((err, res) => {
      account = res[0];
    });
  
    var docRow = $('#docRow');
    docRow.empty();

    DataStore.deployed().then(function(instance) {
      datastore = instance;

      //Need length of user list as documents are associated with each user
      return datastore.getNumUsers(0, {from: account});
    }).then(async function(res) {
      var numUsers = res;

      for (let i = 0; i < numUsers; i ++) {

        //Go through the user's documents
         datastore.getNumDocsForUserById(i, {from: account}).then(function(res) {
          for (let j = 0; j < res; j ++) {
            var docTemplate = $('#docTemplate');
            var giveEth = docTemplate.find('#give-eth');
            var docAccount;
            datastore.getUserByIndex(i, {from: account}).then(function(res) {
              docAccount = res;
            });

            datastore.getDocByUserIndex(i, j, {from: account}).then(function(res) {
              var byteHash = res;
              var convertedHash = self.bytes32ToIPFSHash(res);

              ipfs.files.get(convertedHash).then(res => {
                var outputString = res[0].content.toString('utf8');
                var truncatedString = self.truncateString(outputString);
                var readMore = docTemplate.find('#read-more');

                datastore.getDocTitleByUserIndex(i, j, {from: account}).then(function(res) {
                  
                  docTemplate.find('#panel-content').text(truncatedString);
                  giveEth.hide();

                  //Do not show option to donate to self
                  if(account != docAccount) {
                    giveEth.show();
                    giveEth.attr('data-hash', byteHash);
                  }

                  //Add the hash to the element for reference
                  readMore.attr('data-hash', byteHash);
                  readMore.attr('data-title', res);

                  docTemplate.find('.panel-title').text(res);
                  docTemplate.find('.panel-title').attr('data-title', res);

                  docRow.append(docTemplate.html());

                }).catch(function(e){
                  console.log(e);
                  console.log("Could not get title");
                });

              }).catch(function(e){
                console.log(e);
                console.log("Error in retrieving IPFS data");
              });
            }).catch(function(e) {
              console.log(e);
              console.log("Could not get IPFS hash");
            });
          }
        }).catch(function(e) {
          console.log(e);
          console.log("Could not get data");
        });
      }
    }).catch(function(e) {
      console.log(e);
      console.log("Could not get data");
    });

  },

  //Get only the user's own uploads
  getUserDocs: function() {
    var self = this;
    var datastore;

    var docRow = $('#docRow2');
    docRow.empty();

    DataStore.deployed().then(function(instance) {
      datastore = instance;
      return datastore.getNumDocsForUserByAddr({from: account});
    }).then(function(res) {
      var numDocs = res;

      for (let i = 0; i < numDocs; i ++) {
        var docTemplate = $('#docTemplate2');
        datastore.getDocForUser(i, {from: account}).then(function(res){
          var byteHash = res;
          var convertedHash = self.bytes32ToIPFSHash(res);

          ipfs.files.get(convertedHash).then(res => {
            var outputString = res[0].content.toString('utf8');
            var truncatedString = self.truncateString(outputString);
            var expand = docTemplate.find('#expand');

            datastore.getDocTitleForUser(i, {from: account}).then(function(res) {

              //New masonry layout
              docTemplate.find('#panel-content2').text(truncatedString);
              docTemplate.find('#panel-title2').text(res);
              docTemplate.find('#panel-title2').attr('data-title', res);
              expand.attr('data-hash', byteHash);
              expand.attr('data-title', res);

              docRow.append(docTemplate.html());

            }).catch(function(e){
              console.log(e);
              console.log("Could not get title");
            });
  
          }).catch(function(e){
            console.log(e);
            console.log("Error in retrieving IPFS data");
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
  },

  //Create document excerpt. To be displayed on a masonry panel
  truncateString: function(input) {
    var readMore = "......";
    if(input.length > 150) {
      var trimmedInput = input.substring(0, 150); 
      return trimmedInput.substring(0, trimmedInput.lastIndexOf(" ")).concat(readMore);
    } else {
      return input;
    }
  },

  readMore: function(event, type) {
    var self = this;
    var modalContent = $("#modal").find('.modal-content');
    var docTemplate = $('#docTemplate');

    var ipfsHash = event.target.attributes[3].value;
    var convertedHash = self.bytes32ToIPFSHash(ipfsHash);
    var panelTitle = event.target.attributes[7].value;

    //Title reference is different for panels displaying user only uploads
    if(type == 1) {
      panelTitle = event.target.attributes[4].value;
    }

    ipfs.files.get(convertedHash).then(res => {
      var outputString = res[0].content.toString('utf8');
      modalContent.find('#modal-text').text(outputString);
      modalContent.find('.modal-title').text(panelTitle);

    }).catch(function(e) {
      console.log(e);
      console.log("Error in retrieving IPFS data");
    });
  },

  giveEth: function(event) {
    var hash = $(event.target).data('hash');
    var self = this;
    var datastore;

    var handleReceipt = (error, receipt) => {
      if (error) console.error(error);
      else {
        console.log(receipt);
      }
    }

    DataStore.deployed().then(function(instance) {
      datastore = instance;
      return datastore.getAddressFromDoc(String(hash));
    }).then(function(res) {

      //Give 1 Ether
      web3.eth.sendTransaction({ from: account, to: res, value: 10**18 },
        handleReceipt);
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
  App.getFromIpfs();
});
