const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const fse = require('fs-extra');

const httpPort = 3000;

const app = express();
app.use(express.json());

const PUBLIC_KEY = process.env.PUBLIC_KEY || 'BJ7yRPikwuWdlfO06ci4ZyHRVc10RmLkc2H9j1wYJXrWr8O1-c0Yj7MPamWd58k0sxF0v3eoMKp4fUde75fHyIY'
const PRIVATE_KEY = process.env.PRIVATE_KEY || '5_FBJ5BlJ7h864Xkd7kOM_b7pQCGaI0IlzVkzznsjKY'

app.use((req, res, next) => {
    console.log(new Date().toLocaleString() + ' ' + req.url);
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const webpush = require('web-push');

let subscriptions = [];
const SUBS_FILENAME = 'subscriptions.json';
if (fs.existsSync(SUBS_FILENAME) && fs.statSync(SUBS_FILENAME).size > 0) {
    try {
        subscriptions = JSON.parse(fs.readFileSync(SUBS_FILENAME));
    } catch (error) {
        console.error(error);
    }
}

app.post('/check-subscription', function (req, res) {
    const requestedDestination = req.query.destination;
    const subscription = req.body.subscription;

    const isSubscribed = subscriptions.some(item => {
        return item.destination === requestedDestination && JSON.stringify(item.sub) === JSON.stringify(subscription);
    });

    res.json({isSubscribed})
});

app.post('/save-subscription', function (req, res) {
    let requestedDestination = req.query.destination;
    let sub = {'sub': req.body.sub, 'destination': requestedDestination};
    subscriptions.push(sub);
    console.log(sub)
    fs.writeFileSync(SUBS_FILENAME, JSON.stringify(subscriptions));
    res.json({
        success: true
    });
});

async function sendPushNotifications(imageDesc, destination) {
    webpush.setVapidDetails('mailto:test-web2pwa@srv1.mail-tester.com', PUBLIC_KEY, PRIVATE_KEY);
    // https://www.mail-tester.com/test-web2pwa
    for (const sub of subscriptions) {
        if (sub.destination === destination) {
            try {
                console.log('Sending notification to', sub.sub);
                await webpush.sendNotification(sub.sub, JSON.stringify({
                    title: 'New image from ' + destination.replace(/_/g, ' ')
                        .replace(/\b\w/g, (char) => char.toUpperCase()) + '!',
                    body: 'Somebody just uploaded a new photo: ' + imageDesc,
                    redirectUrl: '/destination.html?destination=' + destination
                }));
            } catch (error) {
                console.error(error);
            }
        }
    }
}


const UPLOAD_PATH = path.join(__dirname, 'public', 'uploads');
app.get('/destinations', function (req, res) {
    let destinations = fse.readdirSync(UPLOAD_PATH);
    let latestImages = [];

    let latestFile;
    for (let destination of destinations) {
        const destinationPath = path.join(UPLOAD_PATH, destination);
        if (fse.statSync(destinationPath).isDirectory()) {
            let files = fse.readdirSync(destinationPath);
            latestFile = files.reverse()[0];

            if (latestFile) {
                latestImages.push({destination, file: path.join(destination, latestFile)});
            }
        }
    }
    res.json({latestImages});
});

app.get('/destination', function (req, res) {
    let requestedDestination = req.query.destination;
    const destinationPath = path.join(UPLOAD_PATH, requestedDestination);

    if (!fse.existsSync(destinationPath)) {
        return res.status(404).json({error: 'Destination not found'});
    }
    let files = fse.readdirSync(destinationPath);

    files = files.reverse().splice(0, 10);
    res.json({files});
});

app.post('/save-image', function (req, res) {
    uploadImages(req, res, async function (err) {
        if (err) {
            console.log(err);
            res.json({
                success: false, error: {
                    message: 'Upload failed: ' + JSON.stringify(err)
                }
            });
        } else {
            console.log(req.body);
            res.json({success: true, id: req.body.id});
            let requestedDestination = req.query.destination;
            await sendPushNotifications(req.body.title, requestedDestination);
        }
    });
});

app.post('/save-destination', async function (req, res) {
    let requestedDestination = req.query.destination;
    try {
        await fse.ensureDir(path.join(UPLOAD_PATH, requestedDestination));
    } catch (err) {
        console.error(`An error occurred while creating the folder '${path.join(UPLOAD_PATH, requestedDestination)}':`, err);
    }
    uploadImages(req, res, async function (err) {
        if (err) {
            console.log(err);
            res.json({
                success: false, error: {
                    message: 'Upload failed: ' + JSON.stringify(err)
                }
            });
        } else {
            console.log(req.body);
            res.json({success: true, id: req.body.id});
        }
    });
});

const uploadImages = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            let requestedDestination = req.query.destination;
            cb(null, path.join(UPLOAD_PATH, requestedDestination));
        }, filename: function (req, file, cb) {
            let fn = file.originalname.replaceAll(':', '-');
            console.log(fn)
            cb(null, fn);
        },
    })
}).single('image');


app.listen(httpPort, function () {
    console.log(`HTTP listening on port: ${httpPort}`);
});
