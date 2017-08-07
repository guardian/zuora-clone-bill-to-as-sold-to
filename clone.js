const fs = require('fs')
const async = require('async')
const readline = require('readline')
const request = require('request')

const zuoraSandboxSubdomain = '' // apisandbox.
const zuoraUsername = ''
const zuoraPassword = ''
const zuoraAuthHeaders = {
    apiAccessKeyId: zuoraUsername,
    apiSecretAccessKey: zuoraPassword
}
const jar = request.jar()
const urlPrefix = `https://rest.${zuoraSandboxSubdomain}zuora.com`

const rl = readline.createInterface({
    input: fs.createReadStream('accountids.csv')
})
const hasCookie = jar.getCookies(urlPrefix).length > 0

const allSteps = []

rl.on('line', (accountId) => {
    if (!accountId) return

    let elapsedTime = 0
    const steps = [
        (step) => {
            request({
                url: `${urlPrefix}/v1/object/account/${accountId}?fields=BillToId,SoldToId`,
                method: 'GET',
                headers: (!hasCookie) ? zuoraAuthHeaders : {},
                json: true,
                forever: true,
                jar: jar,
                time: true
            }, (error, response, body) => {
                if (error) {
                    step(error)
                    return
                }
                elapsedTime += response.elapsedTime
                if (body.BillToId === body.SoldToId) {
                    step(null, body.BillToId)
                } else {
                    step(`Skipping account ${accountId} because it already has a dedicated SoldTo contact`)
                }
            })
        },
        (billToId, step) => {
            request({
                url: `${urlPrefix}/v1/object/contact/${billToId}`,
                method: 'GET',
                headers: (!hasCookie) ? zuoraAuthHeaders : {},
                json: true,
                forever: true,
                jar: jar,
                time: true
            }, (error, response, body) => {
                elapsedTime += response.elapsedTime
                step(error, body)
            })
        },
        (contact, step) => {
            delete contact.Id
            request({
                url: `${urlPrefix}/v1/object/contact`,
                method: 'POST',
                headers: (!hasCookie) ? zuoraAuthHeaders : {},
                body: contact,
                json: true,
                forever: true,
                jar: jar,
                time: true
            }, (error, response, body) => {
                elapsedTime += response.elapsedTime
                step(error, body.Id)
            })
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
                jar: jar,
                time: true
            }, (error, response, body) => {
                elapsedTime += response.elapsedTime
                step(error, `Updated account: ${body.Id} (took ${elapsedTime}ms)`)
            })
        }
    ]
    allSteps.push((callback) => {
        async.waterfall(steps, (err, result) => {
            if (err) console.log(err)
            if (result) console.log(result)
            callback(null, result)
        })
    })
})

rl.on('close', () => {
    async.parallelLimit(allSteps, 1, (err, results) => console.log(err, `${results.length} accounts processed.`))
})
