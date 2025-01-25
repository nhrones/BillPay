// deno-lint-ignore-file no-explicit-any
import { focusedRow, makeEditableRow, resetFocusedRow } from './mutableTableRow.ts'
import { signals } from "../src/signals.ts"


const tablehead = document.getElementById('table-head') as HTMLTableSectionElement
let tableBody: HTMLTableSectionElement

/** Build the Table header */
export function buildTableHead(kvCache: any) {
   const tr = `
<tr class="headerRow">
`;
   let th = ''
   for (let i = 0; i < kvCache.columns.length; i++) {
      if (i === 1) {
         th += `    <th id="header${i + 1}" 
   data-index=${i} value=1> ${kvCache.columns[i].name} 
</th>
`;
      } else {
         th += `    <th id="header${i + 1}" 
   data-index=${i} value=1> ${kvCache.columns[i].name} 
</th>
`;
      }

   }
   tablehead.innerHTML += (tr + th)
   tablehead.innerHTML += `</tr>`
}

/** build an HTML table */
export function buildDataTable(kvCache: any) {

   if (!tableBody) {
      tableBody = document.getElementById('table-body') as HTMLTableSectionElement
   }

   const querySet = kvCache.querySet

   tableBody.innerHTML = '';

   if (querySet) {
      for (let i = 0; i < querySet.length; i++) {
         const obj = querySet[i]
         let row = `<tr data-cache_key="${obj[kvCache.columns[0].name]}">
        `
         for (let i = 0; i < kvCache.columns.length; i++) {
            const ro = (kvCache.columns[i].readOnly) ? ' read-only' : ''
            row += `<td data-column_index=${i} data-column_id="${kvCache.columns[i].name}"${ro}>${obj[kvCache.columns[i].name]}</td>
            `
         }
         row += '</tr>'
         tableBody.innerHTML += row
      }
   }

   // assign click handlers for column headers
   for (let i = 0; i < kvCache.columns.length; i++) {
      const el = document.getElementById(`header${i + 1}`) as HTMLElement
      el.onclick = (_e) => {
         resetFocusedRow()
         buildDataTable(kvCache)
      }
   }

   resetFocusedRow()
   buildFooter(kvCache)
   makeEditableRow(kvCache)
}


// required DOM elements 
const addBtn = document.getElementById('addbtn') as HTMLButtonElement
const deleteBtn = document.getElementById('deletebtn') as HTMLButtonElement
const table = document.getElementById("table") as HTMLTableElement

/** build our footer */
export function buildFooter(kvCache: any) {

   addBtn.onclick = (_e) => {
      // make an empty row object using the schema sample
      const newRow = Object.assign({}, kvCache.schema.sample)
      // add it to the cache
      const firstColName = Object.keys(newRow)[0]
      kvCache.set(newRow[firstColName], newRow)
      // update table with new row
      buildDataTable(kvCache)
      // get the last table row
      const lastRow = table.rows[table.rows.length - 1];
      // Scroll to the last row with smooth scrolling
      lastRow.scrollIntoView({ behavior: "smooth" });
   }

   deleteBtn.onclick = (_e) => {
      // delete the map row, then persist the map
      const id = (focusedRow as HTMLTableRowElement).dataset.cache_key as string
      kvCache.delete(id)
      buildDataTable(kvCache)
   }
}

/** Signal handler -> decouples view from data */
signals.on("buildDataTable", "", (cache) => {
   buildDataTable(cache)
})