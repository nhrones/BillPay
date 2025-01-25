// deno-lint-ignore-file no-explicit-any
import { signals } from "../src/signals.ts"
import { KvCache } from "./kvCache.ts";
import type { AppContext } from "../src/main.ts"

//-------------------------------------------------------------------------------
//                            KV-RPC Client
// Our database cache is transactionally consistent at the moment of creation.
// It is kept consistent by binding its transactions to all host DB transactions.
// This durable-shadowing provides the inherent consistency of the cache.
//-------------------------------------------------------------------------------

/** 
 * This db client communicates with an RPC service 
 */
export class KvClient {

   DEV = false
   nextMsgID = 0
   querySet: any[] = []
   transactions = new Map();
   currentPage = 1
   focusedRow = null
   kvCache: KvCache
   CTX: AppContext
   ServiceURL: string
   RegistrationURL: string

   /** ctor */
   constructor(cache: any, ctx: AppContext) {
      this.CTX = ctx
      this.DEV = ctx.DEV
      this.ServiceURL = (ctx.LOCAL_DB) ? ctx.LocalDbURL : ctx.RemoteDbURL
      this.RegistrationURL = this.ServiceURL + ctx.RpcURL
      this.kvCache = cache
      this.transactions = new Map()
   }

   /** initialize our EventSource and fetch some data */
   init() {
      const eventSource = new EventSource(this.RegistrationURL);
      console.log("CONNECTING");
      eventSource.addEventListener("open", () => {
         
         //this.callProcedure(this.ServiceURL, "DELETE", { key: [null] })


         if (this.DEV) console.log("setting pin")
         this.callProcedure(this.ServiceURL, "GET", { key: ["PIN"] })
            .then((result: any) => {
               if (this.DEV) console.log("GET PIN ", result.value)
               const pin = signals.xorEncrypt(result.value)
               if (this.DEV) console.log("GET PIN ", pin);
               this.CTX.PIN = result.value;
               this.fetchQuerySet()
            })
      });

      eventSource.addEventListener("error", (_e) => {
         switch (eventSource.readyState) {
            case EventSource.OPEN:
               console.log("CONNECTED");
               break;
            case EventSource.CONNECTING:
               console.log("CONNECTING");
               break;
            case EventSource.CLOSED:
               console.log("DISCONNECTED");
               break;
         }
      });

      // When we get a message from the service we expect 
      // an object containing {msgID, error, and result}.
      // We then find the transaction that was registered for this msgID, 
      // and execute it with the error and result properities.
      // This will resolve or reject the promise that was
      // returned to the client when the transaction was created.
      eventSource.addEventListener("message", (evt) => {
         const parsed = JSON.parse(evt.data);
         const { txID, error, result } = parsed;            // unpack
         if (txID === -1) { this.handleMutation(result) }   // unsolicited mutation event
         if (!this.transactions.has(txID)) return           // check        
         const transaction = this.transactions.get(txID)    // fetch
         this.transactions.delete(txID)                     // clean up
         if (transaction) transaction(error, result)        // execute
      })

   }

   /**
    * handle Mutation Event
    * @param {{ rowID: any; type: any; }} result
    */
   handleMutation(result: { rowID: any; type: any; }) {
      console.info(`Mutation event:`, result.type)
   }

   /** set Kv Pin */
   async setKvPin(rawpin: string) {
      const pin = signals.xorEncrypt(rawpin)
      await this.callProcedure(this.ServiceURL, "SET", { key: ["PIN"], value: pin })
         .then((_result: any) => {
            if (this.DEV) console.log(`Set PIN ${rawpin} to: `, pin)
         })
   }

   /** fetch a querySet */
   async fetchQuerySet() {
      await this.callProcedure(
         this.ServiceURL,
         "GET",
         { key: [this.CTX.dbOptions.schema.dbKey] }
      ).then((result: any) => {
         //const re = signals.xorEncrypt(result.value)
         //const refix = re.replace("null", `"XYZ"`)
         //this.kvCache.restoreCache(refix)
         this.kvCache.restoreCache(signals.xorEncrypt(result.value))
         })
   }

   /** get row from key */
   get(key: any) {
      for (let index = 0; index < this.querySet.length; index++) {
         const element = this.querySet[index];
         if (element.id === key) return element
      }
   }

   /** The `set` method mutates - will call the `persist` method. */
   set(value: any) {
      try {
         // persist single record to the service
         this.callProcedure(this.ServiceURL, "SET",
            {
               key: [this.CTX.dbOptions.schema.dbKey],
               value: value
            })
            .then((result: any) => {
               this.querySet = result.querySet
               return this.querySet
            })
      } catch (e) {
         return { Error: e }
      }
   }

   /** 
    * Make an Asynchronous Remote Proceedure Call
    *  
    * @param {any} procedure - the name of the remote procedure to be called
    * @param {any} params - appropriately typed parameters for this procedure
    * 
    * @returns {Promise<any>} - Promise object has a transaction that is stored by ID    
    *   in a transactions Set.   
    *   When this promise resolves or rejects, the transaction is retrieves by ID    
    *   and executed by the promise. 
    */
   callProcedure(
      dbServiceURL: string,
      procedure: any,
      params: any
   ): Promise<any> {
      const txID = this.nextMsgID++;
      return new Promise((resolve, reject) => {
         this.transactions.set(txID, (error: string | undefined, result: any) => {
            if (error)
               return reject(new Error(error));
            resolve(result);
         });
         fetch(dbServiceURL, {
            method: "POST",
            mode: 'cors',
            body: JSON.stringify({ txID, procedure, params })
         });
      });
   };
}
