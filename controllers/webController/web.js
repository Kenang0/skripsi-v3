import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import {findUserByEmailKlien,findUserByRole} from "../dashAdminController/authAdmin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// testing sesuatu start
// buat melihat front end aja seblum masuk data kalau masih fornt end aja 
export const liatFrontEnd = async (req, res) => {
  res.render('register_user', {
    // data: [], 
    // error: "" 
    token:""
  });
}
// testing sesuatu end

// seblum login strat
export const ambilhome_belomlogin = async (req, res) => {
  try {
const radio = await pool.query(`
  SELECT p.*, v.nama_toko_vendor, v.photo_vendor, j.hari, j.jam_mulai, j.jam_selesai, pk.kota
  FROM produk_iklan p
  JOIN users_vendor v ON p.vendor_id = v.id_vendor
  LEFT JOIN jadwal_produk_radio j ON p.id_produk_iklan = j.produk_id
  LEFT JOIN pks pk ON v.pks_id = pk.pks_id
  WHERE p.kategori_id = 1 AND p.status_produk = 'aktif'
`);

const sms = await pool.query(`
  SELECT p.*, v.nama_toko_vendor, v.photo_vendor, s.provider_yang_di_layani, s.jenis_target, pk.kota
  FROM produk_iklan p
  JOIN users_vendor v ON p.vendor_id = v.id_vendor
  LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
  LEFT JOIN pks pk ON v.pks_id = pk.pks_id
  WHERE p.kategori_id = 2 AND p.status_produk = 'aktif'
`);
    res.render("web/belom_login/home_page", {
      dataRadio: radio.rows,
      dataSms: sms.rows
    });
  } catch (err) {
    console.error("❌ Gagal ambil data:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};

export const detailProdukPageSmsBlast = async (req, res) => {
  const { id } = req.params;
  try {
    const produk = await pool.query(`
      SELECT p.*, v.nama_toko_vendor, v.photo_vendor, pk.kota,
             s.provider_yang_di_layani, s.jenis_target
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.id_produk_iklan = $1
    `, [id]);

    const produkTerkait = await pool.query(`
      SELECT * FROM produk_iklan
      WHERE vendor_id = $1 AND id_produk_iklan != $2
      ORDER BY RANDOM() LIMIT 8
    `, [produk.rows[0].vendor_id, id]);

    res.render("web/belom_login/produk_page", {
      produk: produk.rows[0],
      produkTerkait: produkTerkait.rows
    });
  } catch (err) {
    console.error("❌ Gagal ambil detail:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};

export const detailProdukSms = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.*, v.nama_toko_vendor, v.photo_vendor, s.provider_yang_di_layani, s.jenis_target, pk.kota
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.id_produk_iklan = $1
    `, [id]);

    if (result.rows.length === 0) return res.status(404).send("Produk tidak ditemukan.");

    const produk = result.rows[0];

    const produkTerkait = await pool.query(`
      SELECT 
        p.*,
        v.nama_toko_vendor, 
        v.photo_vendor,
        pk.kota,
        s.provider_yang_di_layani,
        s.jenis_target,
        j.hari,
        j.jam_mulai,
        j.jam_selesai
      FROM produk_iklan p
      JOIN users_vendor v ON p.vendor_id = v.id_vendor
      LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
      LEFT JOIN jadwal_produk_radio j ON p.id_produk_iklan = j.produk_id
      LEFT JOIN pks pk ON v.pks_id = pk.pks_id
      WHERE p.vendor_id = $1 AND p.id_produk_iklan != $2 AND p.status_produk = 'aktif'
      ORDER BY RANDOM()
      LIMIT 8
    `, [produk.vendor_id, id]);

    res.render("web/belom_login/view_detail_produk_sms", {
      produk,
      produkTerkait: produkTerkait.rows
    });
  } catch (err) {
    console.error("❌ Gagal ambil detail produk SMS:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data.");
  }
};




// sebelum login end


// login dari awal 
// ngambil login page web
export const getLoginPageWeb = (req, res) => {
  res.render("login_user", { error: null });
};

// Login home page dan data token 
export const loginUserWeb = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await findUserByEmailKlien(email);
    if (!user) {
      return res.render("login_user", { error: "Invalid email atau password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("login_user", { error: "Invalid email atau password" });
    }

    const role = await findUserByRole(email);
    const token = jwt.sign({ id: user.id, role, full_name: user.full_name, photo_user : user.photo_user }, process.env.JWT_SECRET, { expiresIn: "3h" });
    res.cookie("token", token, { httpOnly: true });

    const rolesAllowed = ["klien","admin", "partnership", "project lead","Finance"]; // bagian boleh akses, di ganti nanti kalau ada perubahan yang boleh akses
    if (rolesAllowed.includes(role)) {
      res.redirect("/home-page"); 
    } else {
      res.render("login_user", { error: "Unauthorized role" });
    }

  } catch (err) {
    res.status(500).send("Internal Server Error");
  }
};

// ngambil halaman home
export const getHomeweb = async (req, res) => {
 const userId = req.user.id;
  try {
const user = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);

const radio = await pool.query(`
  SELECT p.*, v.nama_toko_vendor, v.photo_vendor, j.hari, j.jam_mulai, j.jam_selesai, pk.kota
  FROM produk_iklan p
  JOIN users_vendor v ON p.vendor_id = v.id_vendor
  LEFT JOIN jadwal_produk_radio j ON p.id_produk_iklan = j.produk_id
  LEFT JOIN pks pk ON v.pks_id = pk.pks_id
  WHERE p.kategori_id = 1 AND p.status_produk = 'aktif'
`);

const sms = await pool.query(`
  SELECT p.*, v.nama_toko_vendor, v.photo_vendor, s.provider_yang_di_layani, s.jenis_target, pk.kota
  FROM produk_iklan p
  JOIN users_vendor v ON p.vendor_id = v.id_vendor
  LEFT JOIN detail_produk_sms s ON p.id_produk_iklan = s.produk_id
  LEFT JOIN pks pk ON v.pks_id = pk.pks_id
  WHERE p.kategori_id = 2 AND p.status_produk = 'aktif'
`);
    res.render("web/sudah_login/home_page_login", {
      dataRadio: radio.rows,
      dataSms: sms.rows,
      dataUser: user.rows[0]
    });
  } catch (err) {
    console.error("❌ Gagal ambil data:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};


// pengatuaran Akun
export const getpengaturan = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [userId]);
    const user = result.rows[0];

    res.render("web/sudah_login/pengaturan_akun", { 
      user
    });
  } catch (err) {
    console.error("❌ Gagal ambil data user:", err);
    res.status(500).send("Terjadi kesalahan.");
  }
};


// login end 