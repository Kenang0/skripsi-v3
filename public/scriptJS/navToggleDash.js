// button for small screen
document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('toggleNavbar');
    const navbarMenu = document.getElementById('navbarMenu');

    // Pastikan tombol dan menu ditemukan
    if (toggleButton && navbarMenu) {
        console.log("Toggle button and navbar menu found!");
        toggleButton.addEventListener('click', () => {
            console.log("Toggle button clicked!");
            navbarMenu.classList.toggle('active');
        });
    } else {
        console.error("Toggle button or navbar menu not found!");
    }
});

// button arrow
document.addEventListener("DOMContentLoaded", () => {
    const dropdownToggles = document.querySelectorAll(".dropdown-toggle");
  
    dropdownToggles.forEach(toggle => {
      toggle.addEventListener("click", (e) => {
        e.preventDefault(); // Mencegah navigasi default
        const parent = toggle.parentElement;
        const dropdownMenu = toggle.nextElementSibling;
  
        // Tutup semua dropdown yang lain
        document.querySelectorAll(".dropdown").forEach(dropdown => {
          if (dropdown !== parent) {
            dropdown.classList.remove("open");
            dropdown.querySelector(".dropdown-menu").style.display = "none";
          }
        });
  
        // Toggle dropdown saat ini
        const isOpen = parent.classList.contains("open");
        parent.classList.toggle("open", !isOpen);
        dropdownMenu.style.display = isOpen ? "none" : "block";
      });
    });
  
    // Klik di luar dropdown untuk menutup semua
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".dropdown")) {
        document.querySelectorAll(".dropdown").forEach(dropdown => {
          dropdown.classList.remove("open");
          dropdown.querySelector(".dropdown-menu").style.display = "none";
        });
      }
    });
  });