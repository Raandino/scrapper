import { chromium } from 'playwright';
import Airtable from 'airtable';
import { parse } from 'node-html-parser';
import 'dotenv/config'

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const table = base('Scraped_Pasajero copy');

const fieldsArray = []; // Array to store fields


// Function to insert records into the new table
async function insertRecords(records) {
    try {
        // Get the new table
        const tableToInsert = base('nodetable');

        // Insert each record into the new table
        await Promise.all(records.map(record => tableToInsert.create(record)));
        console.log('Records inserted successfully');
    } catch (error) {
        console.error('Error inserting records:', error);
    }
}

// Query records from Airtable
table.select({
    // Select options, e.g., fields, filterByFormula, etc.
}).eachPage((records, fetchNextPage) => {
    // Process each page of records
    records.forEach(record => {
        // Push fields of each record to the array
        fieldsArray.push(record.fields);
    });
    
    // Fetch the next page of records
    fetchNextPage();
}, err => {
    if (err) {
        console.error('Error fetching records:', err);
        return;
    }
    
    console.log('Finished fetching records');
     //console.log(fieldsArray)
   


     const chunks = chunkArray(fieldsArray, 20);

     function processChunk(chunk){
        const data = []
       chunk.forEach((item)=>{
            const url = Object.values(item)[0];
            const name = Object.keys(item)[0];
            data.push(scrapeMercadoLibre(url,name))
        })
        return Promise.all(data)
     }


     processChunks(chunks, processChunk).then((result)=>{
        //Es donde yo hago el push a airtable
        
     })

     
});


// Function to split an array into chunks of a given size
function chunkArray(arr, chunkSize) {
    return Array.from({ length: Math.ceil(arr.length / chunkSize) }, (_, i) =>
        arr.slice(i * chunkSize, i * chunkSize + chunkSize)
    );
}

// Function to execute a given function on each chunk
async function processChunks(chunks, func) {
    var resultJoin =[]
    for (const chunk of chunks) {
        const result =  await func(chunk)
        resultJoin.push(...result)
    }

    // Insert the example data into the new table
    resultJoin = resultJoin.map((result)=>{
        var tableParsed
        if(result.specs){
             tableParsed = parse(result.specs).data

        }else{
            tableParsed = 'Error While getting specs'
        }

        return{
            ...result,
            specs: tableParsed
        } 
    })
   
    console.log(resultJoin)
    // await insertRecords(resultJoin);
    await browser.close()
    return resultJoin
    
    //chunks.forEach(chunk => func(chunk));
}

const browser = await chromium.launch(
    {headless: true}
)


async function scrapeMercadoLibre(url,name){


    const context = await browser.newContext();

    const page = await context.newPage()



    try {
        await page.goto(url)
       //await page.waitForTimeout(30000);
        const price = await page.evaluate(() => {
            const priceMeta = document.querySelector("meta[itemprop='price']");
            return priceMeta? priceMeta.getAttribute("content") : null;
        });


        const tableSpecs = await page.evaluate(() => {
            const tableElement = document.querySelector('table.andes-table');
            return tableElement? tableElement.outerHTML : null;
        })

    //const test = await HTMLToJSON('<div><ul><li>Hello <strong>World</strong></li></ul></div>',true)


        const description = await page.evaluate(()=>{
            const result = document.querySelector('.ui-pdp-description__content')?.innerText || null
            return result
        })

        await context.close()

        return {
            name: name,
            url: url,
            price: price,
            specs: tableSpecs,
            description: description
        };
    } catch (e) {
        await context.close();
        console.log(e)
        return 'Error';
    }


}

function htmlTableToJson(htmlContent) {
    // Crear un elemento contenedor temporal para procesar el contenido HTML
    let tempContainer = document.createElement("div");
    tempContainer.innerHTML = htmlContent;
    // Encontrar la tabla en el contenido HTML
    let table = tempContainer.querySelector("table");
    if (!table) {
        return JSON.stringify({ error: "No se encontró ninguna tabla en el HTML." }, null, 4);
    }
    // Encontrar todas las filas en la tabla
    let rows = table.querySelectorAll("tr");
    let tableData = {};
    // Recorrer cada fila y extraer encabezado y valor
    rows.forEach((row) => {
        let header = row.querySelector("th");
        let value = row.querySelector("td");
        // Si existen encabezado y valor, agregar al objeto
        if (header && value) {
            let headerText = header.textContent.trim();
            let valueText = value.textContent.trim();
            tableData[headerText] = valueText;
        }
    });
    // Convertir el objeto a JSON
    return JSON.stringify(tableData, null, 4);
}
