/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/

const SHA256 = require('crypto-js/sha256');
const level = require('level');
const chainDB = './chaindata';
const db = level(chainDB);

/* ===== Level DB ==============================
|  Level DB Helper Function         			   |
|  ===============================================*/

// Add data to levelDB with key/value pair
function addLevelDBData(key,value){
  db.put(key, value, function(err) {
    if (err) return console.log('Block ' + key + ' submission failed', err);
  })
}

// Get data from levelDB with key
function getLevelDBData(key){
  return db.get(key, function(err, value) {
    if (err) return console.log('Not found!', err);
    console.log('Value = ' + value);
  })
}

// Add data to levelDB with value
function addDataToLevelDB(value) {
    let i = 0;
    db.createReadStream().on('data', function(data) {
          i++;
        }).on('error', function(err) {
            return console.log('Unable to read data stream!', err)
        }).on('close', function() {
          console.log('Block #' + i);
          addLevelDBData(i, value);
        });
}

/* ===== Block Class ==============================
|  Class with a constructor for block 			   |
|  ===============================================*/

class Block{
	constructor(data){
     this.hash = "",
     this.height = 0,
     this.body = data,
     this.time = 0,
     this.previousBlockHash = ""
    }
}

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

class Blockchain{
  constructor(){
    //this.chain = [];
    //this.addBlock(new Block("First block in the chain - Genesis block"));
    db.get('blocklength')
      .then(length => this.blockHeight = length -1)
      .catch(() => {
        console.log("Add new Genesis block and init blocklength key value.");
        db.put('blocklength',0)
          .then(() => {
            this.blockHeight = -1;
            this.addBlock(new Block("First block in the chain - Genesis block."))
                .then(() => console.log('Genesis block generated.'));
          })
          .catch((err) => {
            console.log('Block ' + key + ' submission failed', err);
          });  
    })
  }

  // Add new block
  addBlock(newBlock){
    this.blockHeight += 1;
    // Block height
    newBlock.height = this.blockHeight;
    // UTC timestamp
    newBlock.time = new Date().getTime().toString().slice(0,-3);
    // previous block hash
    if(this.blockHeight >0){
      return db.get(this.blockHeight - 1)
        .then((value) => {
          var previousBlock = JSON.parse(value);
          newBlock.previousBlockHash = previousBlock.hash;
          newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
          console.log(JSON.stringify(newBlock));
          return db.put(newBlock.height, JSON.stringify(newBlock));
        })
        .then(() => {return db.put('blocklength',this.blockHeight + 1)});
    }
    console.log("Add new Genesis block");
    newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();
    return db.put(newBlock.height, JSON.stringify(newBlock))
             .then(() => {return db.put('blocklength', this.blockHeight + 1)});    
  }

  // Get block height
    getBlockHeight(){
      return db.get('blocklength')
               .then(value => {this.blockHeight = value - 1; return this.blockHeight;});
    }

    // get block
    getBlock(blockHeight){
      return db.get(blockHeight)
        .then(block => {return JSON.parse(block)})
        .catch(err => {return console.log('Not found!', err)});
    }

    // validate block
    validateBlock(blockHeight){      
      return this.getBlock(blockHeight)
                 .then(block => {
                   let blockHash = block.hash;
                   // remove block hash to test block integrity
                   block.hash = '';
                   // generate block hash
                   let validBlockHash = SHA256(JSON.stringify(block)).toString();
                   // Compare
                   if (blockHash===validBlockHash) {
                     return true;
                   } else {
                     console.log('Block #'+blockHeight+' invalid hash:\n'+blockHash+'<>'+validBlockHash);
                     return false;
                   }
                })
    }

   // Validate blockchain
    validateChain(){
      let errorLog = [];
      let promiseArray = [];
      for (let i = 0 ; i < this.blockHeight; i++) {
        // validate block
        var promise = this.validateBlock(i)
            .then(result => {
            if (!result) {
              errorLog.push(i);
            }
        });

        promiseArray.push(promise);
        console.log('Checking block', i);
        promise = this.getBlock(i)
            .then(block => {
              let blockHash = block.hash;
              return this.getBlock(i+1)
                  .then(block => {
                    let previousHash = block.previousBlockHash;
                    if (blockHash!==previousHash) {
                      errorLog.push(i);
                    }
                  })
            });
        promiseArray.push(promise);
      }
      //validate the final block in the chain
      var promise = this.validateBlock(this.blockHeight)
          .then(result => {
            if (!result) {
              errorLog.push(this.blockHeight);
            }
          });
      promiseArray.push(promise);

      Promise.all(promiseArray)
             .then(() => {
               if (errorLog.length>0) {
                 console.log('Block errors = ' + errorLog.length);
                 console.log('Blocks: '+errorLog);
               } else {
                 console.log('No errors detected');
               }
             });
    }
}
