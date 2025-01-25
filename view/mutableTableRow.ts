// deno-lint-ignore-file no-explicit-any

/** 
 * @module editableTR
 * @description makes a dataTable row editable.
 * @function resetFocusedRow - reset any currently focused row
 * @function makeEditableRow - build table row event handlers for editing
 */

const deleteBtn = document.getElementById('deletebtn') as HTMLButtonElement;
const addBtn = document.getElementById('addbtn') as HTMLButtonElement;

export let focusedRow: HTMLTableRowElement | null

let focusedCell: HTMLTableCellElement

/** reset any focused row */
export function resetFocusedRow(){
    deleteBtn.setAttribute('hidden', "")
    addBtn.removeAttribute('hidden')
    focusedRow = null
}

/** build table row event handlers for editing */
export function makeEditableRow(kvCache: any) {
    const rows = document.querySelectorAll('tr')
    for (const row of Array.from(rows)) {
        // skip the table-header row
        if (row.className.startsWith('headerRow')) continue;

        // build an onclick event handler for each row in the table
        row.onclick = (e) => {
            const target = e.target as HTMLTableCellElement

            // if clicked other than the focused cell, clean up
            if (focusedRow && focusedCell && (e.target != focusedCell)) {
                focusedCell.removeAttribute('contenteditable')
                focusedCell.className = ""
                focusedCell.oninput = null
            }
            // remove any selected row
            focusedRow?.classList.remove("selected_row")
            // set new focusedRow
            focusedRow = row
            focusedRow.classList.add("selected_row")
            addBtn.setAttribute('hidden', "")
            deleteBtn.removeAttribute('hidden')

            // we don't allow editing readonly cells
            if (target.attributes.getNamedItem('read-only')) {
                return // skip any read-only column
            }

            focusedCell = e.target as HTMLTableCellElement
            focusedCell.setAttribute('contenteditable', '')
            focusedCell.className = "editable "

            // when we leave a focused cell, check and save any change
            focusedCell.onblur = () => {
                let key = (focusedRow as HTMLTableRowElement).dataset.cache_key as string
                const col = focusedCell.dataset.column_id || 0;
                const columnIndex = focusedCell.dataset.column_index || 0
                console.log(`focusedCell.onblur key: ${key} col: ${col}, columnIndex ${columnIndex}`)
                console.info("kvCache", kvCache.dbMap)
                const rowObj: any = kvCache.get(key)
                const currentValue = rowObj[col]
                const thisValue = focusedCell.textContent

                // TODO make this look for first columm rather than a named columm
                // first look for change (isDirty)
                if (currentValue !== thisValue) {
                    rowObj[col] = thisValue
                    // if 'expense' we'll need a cacheKey change
                    if (columnIndex === 0) {
                        console.log("FIXING KEY")
                        const newKey = thisValue
                        if (key !== newKey) {
                            kvCache.delete(key)
                            key = thisValue as string;
                            kvCache.set(key, rowObj)
                            
                        }
                    }
                }
                else {
                    kvCache.set(key, rowObj)
                }
            }
        }
    }
    focusedCell?.focus()
}