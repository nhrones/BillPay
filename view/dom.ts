// deno-lint-ignore-file no-explicit-any
//import { restoreData } from "../utils.ts"
import { signals } from "../src/signals.ts"
import { buildTableHead } from './customDataTable.ts'

/** $ shorthand for document.getElementById */
const $  = (id: string) => document.getElementById(id)
/** on - adds an event handler to an htmlElement */
const on = (elem: any, event: string, listener: any) => {
   return elem.addEventListener(event, listener)
}
/** 
 * @module domEventHandlers
 * @description  This module initialized DOM objects and their event handlers
 * @abstract - This module leverages JSDoc comments for type checking.
 * 
 * @function resetIndicators - resets Order indicator elements
 * @function initDOMelements - initializes DOM objects and event handlers.
 */

export const popupDialog = $("popupDialog") as HTMLDialogElement
export const pinDialog = $("myDialog") as HTMLDialogElement
export const pinInput = $("pin") as HTMLInputElement
export const popupText = $("popup_text") as HTMLElement

let pinTryCount = 0
let pinOK = false

/** Initialize DOM elements, and attach common event handlers */
export function initDOM(
   kvCache: any, 
) {

   // build the table head section first
   buildTableHead(kvCache)

   // We've added key commands for backup and restore
   document.addEventListener('keydown', function (event) {
      if (event.ctrlKey && event.key === 'b') {
         event.preventDefault();
         if (kvCache.CTX.DEV) console.log('Ctrl + B backup data');
         backupData(kvCache)
      }
      if (event.ctrlKey && event.key === 'r') {
         event.preventDefault();
         if (kvCache.CTX.DEV) console.log('Ctrl + R restore data');
         restoreData()
      }
   });

   // popup click handler -> this closes the msg popup
   on(popupDialog, 'click', (event: { preventDefault: () => void; }) => {
      event.preventDefault();
      popupDialog.close();
   });

   // popup close handler -> we reopen the pin input dialog
   on(popupDialog, 'close', (event: { preventDefault: () => void; }) => {
      event.preventDefault();
      if (!pinOK) pinDialog.showModal()
   });

   // popup keyup handler -> any key to close
   on(popupDialog, "keyup", (event: { preventDefault: () => void; }) => {
      event.preventDefault()
      popupDialog.close()
      if (!pinOK) pinDialog.showModal()
   });

   pinDialog?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
          event.preventDefault();
      }
  });

   // pin input keyup handler
   on(pinInput, 'keyup', (event: any) => {
      event.preventDefault()
      const pinIn = pinInput as HTMLInputElement
      const pinDia = pinDialog as HTMLDialogElement
      const ecriptedPin = signals.xorEncrypt(pinIn.value)
      if (event.key === "Enter" || ecriptedPin === kvCache.CTX.PIN) {  
         pinTryCount += 1
         if (ecriptedPin === kvCache.CTX.PIN) { 
            pinIn.value = ""
            pinOK = true
            pinDia.close()
         } else {
            pinDia.close()
            pinIn.value = ""
            pinOK = false
            if (popupText) popupText.textContent = (pinTryCount === 3)
               ? `Incorrect pin entered ${pinTryCount} times!
 Please close this Page!`
               : `Incorrect pin entered ${pinTryCount} times!`

            if (pinTryCount === 3) {
               document.body.innerHTML = `
               <h1>Three failed PIN attempts!</h1>
               <h1>Please close this page!</h1>`
            } else {
               (popupDialog as HTMLDialogElement).showModal()
            }
         }
      }
   })

   // Request our user to enter their `Personal Identification Number` 
   if (kvCache.CTX.BYPASS_PIN) {
      pinOK = true
   } else {
      // initialize pin input dialog
      pinDialog.showModal();
      //@ts-ignore ?
      pinInput.focus( { focusVisible: true } )
   }
}

/**
 * export data from dbMap
 * @returns void - calls saveDataFile()
 */
function backupData(kvCache: any) {
   // get all records
   const jsonData = JSON.stringify(Array.from(kvCache.dbMap.entries()))
   const link = document.createElement("a");
   const file = new Blob([jsonData], { type: 'application/json' });
   link.href = URL.createObjectURL(file);
   link.download = "backup.json";
   link.click();
   URL.revokeObjectURL(link.href);
}

 /** import data from backup file */
 export function restoreData() {
    const fileload = document.getElementById('fileload') as HTMLInputElement
    fileload?.click()
    fileload?.addEventListener('change', function () {
       const reader = new FileReader();
       reader.onload = function () {
          signals.fire("restoreCache", "", reader.result as string)
          globalThis.location.reload()
       }
       reader.readAsText(fileload.files![0]);
    })
 }