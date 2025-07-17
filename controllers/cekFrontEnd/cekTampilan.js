
import dotenv from "dotenv";

dotenv.config();
export const liatFrontEnd = async (req, res) => {
  res.render('web/coba_tampilan/produk_sms_blast_pesan', {
    // data: [], 
    // error: "" 
    token:"",
    googleMapsApiKey: process.env.Maps_API
  });
}

export const tampilkanPeta = (req, res) => {
  res.render("web/coba_tampilan/coba-maps", {
    googleMapsApiKey: process.env.Maps_API
  });
};

export const cekPemesananSMS = (req, res) => {
  console.log("📦 Data yang diterima dari form:");
  console.log(req.body); // akan menampilkan semua input dari form

  // Kirim balik halaman konfirmasi atau hanya log dulu
  res.send("cek terminal.");
};

export const pengaturan_akun = (req, res) => {
  res.render("web/sudah_login/pengaturan_akun", {
  });
};


export const Produk_radio = (req, res) => {
  res.render("web/sudah_login/view_detail_produk_radio", {
  });
};

export const Pemenesanan_radio = (req, res) => {
  res.render("web/sudah_login/produk_radio_pesan", {
  });
};