const urlParams = new URLSearchParams(window.location.search);
const destination = urlParams.get('destination');

fetch('/destination?destination=' + destination, {
    headers: {
        'Accept': 'application/json'
    }
}).then((res) => {
    if (res.ok) {
        res.json().then((data) => {
            const dest = document.querySelector('#destination');
            let destinationTitleTemplate = document.querySelector('#destination-title');
            const titleClone = destinationTitleTemplate.content.cloneNode(true)


            const title = titleClone.querySelector('h1')
            title.textContent = destination.replace(/_/g, ' ')
                .replace(/\b\w/g, (char) => char.toUpperCase());
            const newImageButton = titleClone.querySelector('#addNewImageButton')
            newImageButton.href = '/add-image.html?destination=' + destination
            dest.appendChild(titleClone)

            for (const image of data.files) {
                const imagesDiv = document.querySelector('#images')

                let imageTemplate = document.querySelector('#imageTemplate');
                const imageClone = imageTemplate.content.cloneNode(true);

                let img = imageClone.querySelector('img');
                img.src = '/uploads/' + destination + '/' + image;

                let imageTitle = imageClone.querySelector('h3');
                imageTitle.textContent = image.split('_').slice(1).join(' ').replace('.png', '')

                imagesDiv.appendChild(imageClone);
            }
        });
    } else if (res.status === 404) {
        window.location.href = '/not-found.html'
    }
})
    .catch((err) => {
        console.log(err);
    });

let notificationBtn = document.getElementById('btnEnableNotifications');

if ('Notification' in window && 'serviceWorker' in navigator) {
    notificationBtn.addEventListener('click', function () {
        Notification.requestPermission().then(async function (res) {
            console.log('Request permission result:', res);
            if (res === 'granted') {
                await setupPushSubscription(destination);
            } else {
                console.log('User denied push notifications:', res);
            }
        });
    });
} else {
    notificationBtn.setAttribute('disabled', '');
    notificationBtn.classList.add('btn-outline-danger');
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function setupPushSubscription(destination) {
    try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (sub) {
            // Check if the existing subscription is for the desired destination
            const isSubscribedToDestination = await checkIfSubscribedToDestination(sub, destination);
            if (isSubscribedToDestination) {
                alert('You are already subscribed to ' + destination);
                return;
            }
        }

        if (sub === null) {
            const publicKey = 'BJ7yRPikwuWdlfO06ci4ZyHRVc10RmLkc2H9j1wYJXrWr8O1-c0Yj7MPamWd58k0sxF0v3eoMKp4fUde75fHyIY';
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
        }

        const res = await fetch('/save-subscription?destination=' + destination, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({sub}),
        });

        if (res.ok) {
            alert('You are now subscribed to ' + destination);
        } else {
            console.log('Subscription failed:', res.status);
        }

    } catch (error) {
        console.log('Error setting up subscription:', error);
    }
}

async function checkIfSubscribedToDestination(subscription, destination) {
    const res = await fetch('/check-subscription?destination=' + destination, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({subscription}),
    });

    if (res.ok) {
        const data = await res.json();
        return data.isSubscribed;
    }

    console.error('Error checking subscription:', res.status);
    return false;
}

// TODO everything that is left to do
// solution in edgar
// push to git and deploy