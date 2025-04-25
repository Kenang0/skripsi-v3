const progress = document.getElementById("progress");
const nextBtn = document.getElementById("next");
const prevBtn = document.getElementById("prev");
const progressSteps = document.querySelectorAll(".progress-step .fa-solid");
const formSteps = document.querySelectorAll(".form-step");


let currentStep = 4;
updateForm(); // Inisialisasi tampilan

const next = () => {
    if (currentStep < formSteps.length - 1) {
        currentStep++;
        updateForm();
    } else {
        alert("Form submitted!"); // Bisa diganti dengan fungsi submit form
    }
};

const prev = () => {
    if (currentStep > 0) {
        currentStep--;
        updateForm();
    }
};

function updateForm() {
    console.log("Current Step:", currentStep); // Debugging log

    // Menampilkan hanya form yang sesuai dengan langkah saat ini
    formSteps.forEach((step, index) => {
        if (index === currentStep) {
            step.classList.add("active");
            step.style.display = "block"; 
        } else {
            step.classList.remove("active");
            step.style.display = "none"; 
        }
    });

    // Update progress step visuals
    progressSteps.forEach((step, index) => {
        if (index <= currentStep) {
            step.classList.add("active");
        } else {
            step.classList.remove("active");
        }
    });

    
    let isMobile = window.innerWidth <= 480;

 
    let progressWidth;
    if (isMobile) {
        progressWidth = (currentStep / (formSteps.length - 1)) * 85; // layar Lebih kecil mobile S s/d L
    } else {
        progressWidth = (currentStep / (formSteps.length - 1)) * 90; // layar Default untuk tablet & laptop
    }
    
    progress.style.width = progressWidth + "%";

    // Atur tombol prev dan next dengan class .disabled dari CSS
    if (currentStep === 0) {
        prevBtn.classList.add("disabled"); // Nonaktifkan tombol Prev
    } else {
        prevBtn.classList.remove("disabled");
    }

    // Ubah teks tombol Next menjadi "Selesai" saat di langkah terakhir
    nextBtn.innerText = currentStep === formSteps.length - 1 ? "Selesai" : "Berikutnya";
}

// **Tambahkan event listener langsung ke tombol untuk mencegah error onclick**
nextBtn.addEventListener("click", next);
prevBtn.addEventListener("click", prev);
