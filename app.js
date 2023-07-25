const pt = require('puppeteer');
const fs = require('fs');
let rawdata = fs.readFileSync('todoist.com.cookies.json');
let mycookies = JSON.parse(rawdata);
const ITEM_QTY = 5;

pt.launch({ headless: false }).then(async browser =>{
    //open a tab for the source
    let page = await browser.newPage();
    let tasks = await getTasks('https://trello.com/b/QvHVksDa/personal-work-goals', page);
    //open up a second tab for the destination
    page = await browser.newPage();
    //had to provide login cookies as cloudfare didn't allow for normal login
    await page.setCookie(...mycookies); 
    await page.goto("https://todoist.com/app/");
    await page.waitForSelector(".plus_add_button");
    await page.click(".plus_add_button");
    
    //ran into a bug where the new task form didn't open after clicking pressing the '+' button
    //in that case I give it a second and try again
    try{
        await page.waitForSelector("div[aria-label='Task name']", { timeout: 1_000 })
    }catch(e){
        await page.click(".plus_add_button");
    }

    for(let i = 0; i < tasks.length; i++){
        let titlebox = await page.$("div[aria-label='Task name']");
        titlebox = await titlebox.$("p");
        await titlebox.evaluate((box, task)=> box.innerText = task, tasks[i]);
        
        await page.click("button[data-testid='task-editor-submit-button']");
        //waiting for the form to reset befor pushing another item
        await page.waitForSelector("p[data-placeholder='Task name']");

    }

});

async function getTasks(url, page){
    await page.goto(url);
    let containers = await page.$$(".list");
    //I get all the containers at the same time, then get the list within each one
    containers = await Promise.all(
        containers.map(async cont =>  await cont.$(".list-cards"))
    );

    let tasks = [];

    //Iterate over those lists to get the items into a single list whose size is determined at the start of the script
    while(tasks.length < ITEM_QTY && containers.length > 0){
        let cards = await containers.shift().$$(".list-card");
        cards = await Promise.all(
            cards.map(async card => {
                let c = await card.$(".list-card-details");
                c = await c.$(".list-card-title");
                c = await c.getProperty("innerText");
                return c.jsonValue();
            })
        );
        cards.forEach(c => {
            if(tasks.length < ITEM_QTY)
                tasks.push(c);
        });
    }
    //finally, it returns an array of clean strings with the requested number of items
    return tasks;
}


