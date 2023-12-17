fetch('/destinations', {
    headers: {
        'Accept': 'application/json'
    }
}).then()
    .then((res) => {
        if (res.ok) {
            res.json().then((data) => {
                for (const destination of data.latestImages) {
                    let destinationsDiv = document.querySelector("#destinations");
                    let template = document.querySelector("#destinationTemplate");
                    const clone = template.content.cloneNode(true);

                    let img = clone.querySelector("img");
                    img.src = "/uploads/" + destination.file;

                    let link = clone.querySelector("a");
                    link.href = '/destination.html?destination=' + destination.destination

                    let titleElement = clone.querySelector("h3");
                    titleElement.textContent = destination.destination.replace(/_/g, ' ')
                        .replace(/\b\w/g, (char) => char.toUpperCase());

                    destinationsDiv.appendChild(clone);
                }
            });
        } else if (res.status === 404) {
            window.location.href = '/not-found.html'
        }
    })
    .catch((err) => {
        console.log(err);
    });