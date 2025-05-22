# markdown page missing lines

packages/textract/src/MarkdownPage.ts
packages/textract/src/__tests__/MarkdownPage.spec.ts

In MarkdownPage there is a primary loop over layoutItems.
An alternative approach would be to loop over lines.

Right now the code only loops over layoutItems.
layoutItems is used because it returns more semantically correct data.
layoutItems is not guaranteed to have all lines.

I would like to change MarkdownPage so both are considered.
I would like the loop to go over layoutItems and lines simultaneously.
As long as the first word of both is the same, use the layout item.
If the first word is not the same, loop over lines and push those items onto render items.
Do this until the first word of the line matches the first word of the layoutItems.

```javascript
function sameFirstWord(...items) {
  // compare items[0].id === items[1].id === ...
}

let layoutIndex = 0;
for(let lineIndex = 0, lineIndex < lines.length; lineIndex++) {
  const lineItem = lines[lineIndex];
  const layoutItem = layoutItems[layoutIndex];

  if(sameFirstWord(layoutItem, lineItem)) {
    // Current logic: process the layoutItem

    // Only increment layoutIndex if we processed a layout item
    if(layoutIndex < lines.length) layoutIndex++;
  } else {
    // Current logic: process the lineItem
  }
}

if(layoutIndex < layoutItems.length) {
  const extraLayoutItemCount = 
  console.warn(`[textract]`)
}
```

Be careful for boundary cases like a bunch of lines at the end of a document when layoutItems is empty.
Log a warning if there is ever a layoutItems not in lines (per itemFirstWord).