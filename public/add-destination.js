import {set} from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';

let player = document.getElementById('player');
let canvas = document.getElementById('cnvImage');
let beforeCapture = document.getElementById('beforeCapture');
let afterCapture = document.getElementById('afterCapture');
let imageDescription = document.getElementById('imageDescription');
let destinationName = document.getElementById('destinationName')
const fileInput = document.getElementById('fileInput');

let startCapture = function () {
    beforeCapture.classList.remove('d-none');
    beforeCapture.classList.add('d-flex', 'flex-column', 'align-items-center');
    afterCapture.classList.remove('d-flex', 'flex-column', 'align-items-center');
    afterCapture.classList.add('d-none');

    if (!('mediaDevices' in navigator)) {
        // Fallback to file upload
        beforeCapture.classList.remove('d-flex', 'flex-column', 'align-items-center');
        beforeCapture.classList.add('d-none');
        fileInput.classList.remove('d-none');
        fileInput.classList.add('d-flex', 'flex-column', 'align-items-center')

    } else {
        navigator.mediaDevices
            .getUserMedia({video: true, audio: false})
            .then((stream) => {
                player.srcObject = stream;
            })
            .catch((err) => {
                // Fallback to file upload
                beforeCapture.classList.remove('d-flex', 'flex-column', 'align-items-center');
                beforeCapture.classList.add('d-none');
                fileInput.classList.remove('d-none');
                fileInput.classList.add('d-flex', 'flex-column', 'align-items-center')
                alert('Media stream not working, try uploading your picture!');
                console.log(err);
            });
    }
};
startCapture();
let stopCapture = function () {
    afterCapture.classList.remove('d-none');
    afterCapture.classList.add('d-flex', 'flex-column', 'align-items-center');
    fileInput.classList.add('d-none')
    fileInput.classList.remove('d-flex', 'flex-column', 'align-items-center');
    beforeCapture.classList.remove('d-flex', 'flex-column', 'align-items-center');
    beforeCapture.classList.add('d-none');
    if (player.srcObject) {
        player.srcObject.getVideoTracks().forEach(function (track) {
            track.stop();
        });
    }
};

fileInput.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        stopCapture();
    }
});

document.getElementById('btnCapture').addEventListener('click', function (event) {
    canvas.width = player.getBoundingClientRect().width;
    canvas.height = player.getBoundingClientRect().height;
    canvas
        .getContext('2d')
        .drawImage(player, 0, 0, canvas.width, canvas.height);
    stopCapture();
});

document
    .getElementById('btnUpload')
    .addEventListener('click', function (event) {
        event.preventDefault();
        if (!destinationName.value.trim()) {
            alert('Add a destination name please.');
            return;
        }
        if (!imageDescription.value.trim()) {
            alert('Describe this picture please.');
            return;
        }

        const destination = destinationName.value.trim().toLowerCase();

        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            let url = canvas.toDataURL();
            fetch(url)
                .then((res) => res.blob())
                .then((blob) => {
                    let ts = new Date().toISOString();
                    let id = ts + '_' + imageDescription.value.replace(/\s/g, '_');
                    set(id, {
                        id, ts, title: imageDescription.value, image: blob, destination: destination.replace(/\s/g, '_')
                    });

                    return navigator.serviceWorker.ready;
                })
                .then((sw) => {
                    return sw.sync.register('sync-destinations');
                })
                .then(() => {
                    console.log('Queued for sync');
                    startCapture();
                })
                .catch((error) => {
                    alert(error);
                    console.log(error);
                });
        } else {
            let image = entry[1];
            let formData = new FormData();
            formData.append('id', image.id);
            formData.append('ts', image.ts);
            formData.append('title', image.title);
            formData.append('image', image.image, image.id + '.png');

            fetch('/save-destination?destination=' + destination, {
                method: 'POST', body: formData,
            }).then((res) => {
                if (res.ok) {
                    console.log('Destination created and image uploaded successfully')
                } else {
                    alert('Failed to create destination and upload image and your browser does not support background sync!');
                    console.log(res);
                }
            }).catch(function (error) {
                alert('Failed to create destination and upload image and your browser does not support background sync!');
                console.log(error);
            });
        }
    });
