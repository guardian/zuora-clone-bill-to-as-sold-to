const fs = require('fs');
const async = require('async');
const readline = require('readline');
const request = require('request');

const zuoraSandboxSubdomain = '';
const zuoraUsername = '';
const zuoraPassword = '';
const zuoraAuthHeaders = {
    apiAccessKeyId: zuoraUsername,
    apiSecretAccessKey: zuoraPassword
};
const jar = request.jar();
const urlPrefix = `https://rest.${zuoraSandboxSubdomain}zuora.com`;

const rl = readline.createInterface({
    input: fs.createReadStream('accountids.csv')
});

rl.on('line', (accountId) => {
    const hasCookie = jar.getCookies(urlPrefix).length > 0;
    const steps = [
        (step) => request({
            url: `${urlPrefix}/v1/object/account/${accountId}`,
            method: 'GET',
            headers: (!hasCookie) ? zuoraAuthHeaders : {},
            json: true,
            forever: true,
            jar: jar
        }, (error, response, body) => {
            if (body.BillToId === body.SoldToId) {
                step(null, body.BillToId)
            } else {
                step(`Skipping account ${accountId} because it already has a dedicated SoldTo contact`);
            }
        }),
        (billToId, step) => request({
            url: `${urlPrefix}/v1/object/contact/${billToId}`,
            method: 'GET',
            headers: (!hasCookie) ? zuoraAuthHeaders : {},
            json: true,
            forever: true,
            jar: jar
        }, (error, response, body) => step(error, body)),
        (contact, step) => {
            delete contact.Id;
            request({
                url: `${urlPrefix}/v1/object/contact`,
                method: 'POST',
                headers: (!hasCookie) ? zuoraAuthHeaders : {},
                body: contact,
                json: true,
                forever: true,
                jar: jar
            }, (error, response, body) => step(error, body.Id));
        },
        (soldToId, step) => {
            request({
                url: `${urlPrefix}/v1/object/account/${accountId}`,
                method: 'PUT',
                headers: (!hasCookie) ? zuoraAuthHeaders : {},
                body: {
                    SoldToId: soldToId
                },
                json: true,
                forever: true,
                jar: jar
            }, (error, response, body) => step(error, `Updated account: ${body.Id}`));
        }
    ];
    async.waterfall(steps, console.log);
});

rl.on('close', console.log);
