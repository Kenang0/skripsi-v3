import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ngambil login page vendor
export const getLoginPageVendor = (req, res) => {
    res.render("loginVendor", { error: null });
  };
  
  // mencari email dari tabel user
  export const findUserByEmail = async (email_vendor) => {
    const query = "SELECT * FROM users_vendor WHERE email_vendor = $1";
    const result = await pool.query(query, [email_vendor]);
    return result.rows[0];
  };
  
// buat login vendor simpan id sama nama_toko di token
  export const loginUserVendor = async (req, res) => {
    const { email, password } = req.body;
    try {
      const user_vendor = await findUserByEmail(email);
      if (!user_vendor) {
        return res.render("loginVendor", { error: "Invalid email atau password" });
      }
  
      const isMatch = await bcrypt.compare(password, user_vendor.password_vendor);
      if (!isMatch) {
        return res.render("loginVendor", { error: "Invalid email atau password" });
      }
  
      const token = jwt.sign(
        { id: user_vendor.id_vendor, nama_toko_vendor: user_vendor.nama_toko_vendor },
        process.env.JWT_SECRET,
        { expiresIn: "3h" }
      );
      res.cookie("token", token, { httpOnly: true });
      res.redirect("/vendor/dashboardVendor");
    } catch (err) {
      res.status(500).send("Internal Server Error");
    }
  };
  

// ngambil halaman home dash vendor
export const getDashVendorHome = async (req, res) => {
    res.render("dashVendor/dashboardVendor", {
      partial: 'HomeVendor',
      data: "",
      error: ""
    });

};

// ngambil halaman tambah produk
export const getTambahProduk = async (req, res) => {
  try {
    const kategori = await pool.query("SELECT * FROM kategori");
    res.render("dashVendor/dashboardVendor", {
    partial: './produk/tambahProduk',
    data: kategori.rows,
    error: ""
  });
} catch (err) {
  console.error("Gagal ambil kategori:", err);
    res.status(500).send("Gagal mengambil data kategori.");
}
};


// buat submit tombol di halaman tambah produk
export const postTambahProduk = async (req, res) => {
  const vendor_id = req.user.id;
  const { kategori_id, nama_produk, deskripsi_produk, harga } = req.body;
  console.log("🔥 req.user:", req.user);
  console.log("📦 req.body:", req.body);
  try {
    // 1. Simpan ke produk_iklan
    const result = await pool.query(
      `INSERT INTO produk_iklan (vendor_id, kategori_id, nama_produk, deskripsi_produk, harga, status_produk)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_produk_iklan`,
      [vendor_id, kategori_id, nama_produk, deskripsi_produk, harga, 'aktif']
    );

    const produkIdBaru = result.rows[0].id_produk_iklan;

    // === KATEGORI: RADIO ===
    if (kategori_id === "1") {
      const { jam_mulai, jam_selesai, hari_tayang } = req.body;

      // handle input hari_tayang bisa string (1 hari) atau array (beberapa hari)
      const hariArray = Array.isArray(hari_tayang) ? hari_tayang : [hari_tayang];

      for (const hari of hariArray) {
        await pool.query(
          `INSERT INTO jadwal_produk_radio (produk_id, hari, jam_mulai, jam_selesai)
           VALUES ($1, $2, $3, $4)`,
          [produkIdBaru, hari, jam_mulai, jam_selesai]
        );
      }
    }

    res.redirect("/vendor/dashboardVendor");
  } catch (err) {
    console.error("Gagal simpan produk:", err);
    res.status(500).send("Terjadi kesalahan saat menyimpan produk.");
  }
};

