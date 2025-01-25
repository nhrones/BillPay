// deno-lint-ignore-file no-explicit-any
import { KvClient } from "./kvClient.ts"
import { signals } from "../src/signals.ts"
import type { AppContext } from "../src/main.ts"

/**  
 * This `In-Memory-cache` leverages ES6-Maps. 
 */
export class KvCache {

   dbKey = ''
   schema: any
   nextMsgID = 0
   querySet: any[] = []
   callbacks: Map<string, any>
   columns: any[] = []
   kvClient: KvClient
   dbMap: Map<string, unknown>
   raw: any[] = []
   CTX: AppContext
   DEV: boolean

   /** ctor */
   constructor(ctx: AppContext) {
      this.dbKey = `${ctx.dbOptions.schema.dbKey}`
      this.schema = ctx.dbOptions.schema
      this.CTX = ctx
      this.DEV = this.CTX.DEV
      this.callbacks = new Map()
      this.dbMap = new Map<string, typeof this.schema.sample>()
      this.columns = this.buildColumnSchema(this.schema.sample)
      this.kvClient = new KvClient(this, ctx)
      this.kvClient.init()
      signals.on("restoreCache", "", (result) => {
         this.restoreCache(result)
      })
   }

   /** 
    * restores our cache from a json string 
    */
   restoreCache(records: string) {
      const pwaObj = JSON.parse(records)
      this.dbMap = new Map(pwaObj)
      this.persist()
      const result = this.hydrate()
      if (result == 'ok') {
         signals.fire("buildDataTable", "", this)
      }
   }

   /**
    * extract a set of column-schema from the DB.schema object
    */
   buildColumnSchema(obj: { [s: string]: unknown; } | ArrayLike<unknown>) {
      const columns: {
         name: string,
         type: string,
         readOnly: boolean,
         order: string
      }[] = []

      for (const [key, value] of Object.entries(obj)) {
         let read_only = false;
         if ((typeof value === 'number' && value === -1) ||
            (typeof value === 'string' && value === 'READONLY')) {
            read_only = true
         }
         columns.push({
            name: `${key}`,
            type: `${typeof value}`,
            readOnly: read_only,
            order: 'ASC'
         })
      }
      return columns
   }

   /**
    * Persist the current dbMap to Kv   
    * This is called for any mutation of the dbMap (set/delete)
    */
   persist(order = true) {
      if (this.DEV) console.log("Persisting -> sorted? ", order)
      if (order) {
         this.dbMap = new Map([...this.dbMap.entries()].sort());
      }
      const mapString = JSON.stringify(Array.from(this.dbMap.entries()))
      const encrypted = signals.xorEncrypt(mapString)
      this.kvClient.set(encrypted)
   }

   /** hydrate a dataset from a single raw record stored in kvDB */
   hydrate() {
      this.raw = [...this.dbMap.values()]
      this.querySet = [...this.raw]
      signals.fire("buildDataTable", "", this)
      return (this.raw.length > 2) ? "ok" : 'Not found'
   }

   /** resest the working querySet to original DB values */
   resetData() {
      this.querySet = [...this.raw]
   }

   clean(what: string | null = null) {
      const cleanMap = new Map()
      const keys = [...this.dbMap.keys()]
      keys.forEach((value) => {
         if (value !== what) {
            cleanMap.set(value, this.dbMap.get(value))
         }
      })
      this.dbMap = cleanMap
      this.persist(true)
   }

   /** The `set` method mutates - will call the `persist` method. */
   set(key: string, value: any) {
      try {
         this.dbMap.set(key, value)
         this.persist(true)
         this.hydrate()
         return key
      } catch (e) {
         console.error('error setting ')
         return 'Error ' + e
      }
   }

   /** The `get` method will not mutate records */
   get(key: string) {
      try {
         const result = this.dbMap.get(key)
         return result
      } catch (e) {
         return 'Error ' + e
      }
   }

   /** The `delete` method mutates - will call the `persist` method. */
   delete(key: string) {
      try {
         const result = this.dbMap.delete(key)
         if (result === true) this.persist(true)
         this.hydrate()
         return result
      } catch (e) {
         return 'Error ' + e
      }
   }
}
