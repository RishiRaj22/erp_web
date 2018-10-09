const express = require('express');
const app = express();
const bodyParser = require('body-parser')
const puppeteer = require('puppeteer');
const fs = require('fs');


//Comment the 8 lines below to run locally(required to enforce https)
app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`)
    } else {
        next();
    }
});
  

var datas = {};
var images = {};

const url = "http://115.114.127.54:8080/psc/bitcsprd/EMPLOYEE/HRMS/c/SA_LEARNER_SERVICES.B_SS_ATTEND_ROSTER.GBL?PortalActualURL=http://115.114.127.54:8080/psc/bitcsprd/EMPLOYEE/HRMS/c/SA_LEARNER_SERVICES.B_SS_ATTEND_ROSTER.GBL&PortalRegistryName=EMPLOYEE&PortalServletURI=http://115.114.127.54:8080/psp/bitcsprd/&PortalURI=http://115.114.127.54:8080/psc/bitcsprd/&PortalHostNode=HRMS&NoCrumbs=yes&PortalKeyStruct=yes";
async function run(uid,pwd,req,res) {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(90000)

    await page.goto(url);

    // dom element selectors
    const USERNAME_SELECTOR = '#userid';
    const PASSWORD_SELECTOR = '#pwd';
    const BUTTON_SELECTOR = '.psloginbutton';

    await page.click(USERNAME_SELECTOR);
    await page.keyboard.type(uid);

    await page.click(PASSWORD_SELECTOR);
    await page.keyboard.type(pwd);
    datas[uid].message = "Verifying your credentials";
    await Promise.all([
        page.click(BUTTON_SELECTOR),
        page.waitForNavigation({ waitUntil: 'load' })
    ])
    var title = await page.title();
    if(title ==="Oracle | PeopleSoft Enterprise Sign-in") {
        var data = {
            success: false,
            message: "Invalid credentials or server down",
            redirectLink: '/',
            loading: false
        };
        datas[uid] = data;
        return;
    } else {
        datas[uid].message = 'Checking attendance';
        const ATTEND_CHECK = 'document.getElementById("SSR_DUMMY_RECV1$sels$0") != null';
        const ATTEND_BUTTON = '#DERIVED_AA2_B_ATTEND_ROSTER';
        await page.waitForFunction(ATTEND_CHECK);
        await page.click("input[type='radio']");
        await Promise.all([
            page.click(ATTEND_BUTTON),
            page.waitForNavigation({ waitUntil: 'load' })
        ])
        const TABLE_CHECK = '.psimage';
        await page.waitForSelector(TABLE_CHECK);
        const scr = 'result/'+ uid;
        await page.screenshot().then(function(buffer) {
            images[uid] = buffer;
            var data = {
                success: true,
                loading: false,
                message: "Success",
                redirectLink: '/' + scr
            };
            datas[uid] = data;
        })
    }
} catch(er) {
    console.log(er)
    var data = {
        success: false,
        message: "Couldnot fetch results",
        redirectLink: '/',
        loading: false
    };
    datas[uid] = data;
}
browser.close();
}

app.use(express.static('public'))
app.use(bodyParser.json())

app.get('/result/:uid',function(req,res) {
    var uid = req.params.uid;
    res.setHeader('Content-Type', 'image/png');
    res.send(images[uid])
})

app.get('/available/:uid',function(req,res) {
    var uid = req.params.uid;
    var data = {};
    if(datas[req.query.uid] == undefined) {
        data = datas[uid];
    } else {
        data.success = false;
        data.message = 'Invalid request';
    }
    res.send(JSON.stringify(data));
})

app.post('/fetch/', function(req, res) {
    var uid = req.body.uid;
    var pwd = req.body.pwd;
    var data = {
        success: false,
        message: "Connecting to ERP server",
        loading: true
    };
    datas[uid] = data;
    res.setHeader('Content-Type', 'application/json');
    var d = {
        pingUrl:  '/available/' + uid
    };
    res.send(d);
    run(uid,pwd,req,res);
});

var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
var server_ip_address = process.env.IP || process.env.OPENSHIFT_NODEJS_IP ||  '0.0.0.0';

app.listen(server_port,server_ip_address, function () {
    console.log('App listening on ' + server_ip_address + ":" + server_port)
})