import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { error } from "console";
import ejs from "ejs";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

//  multer upload produk 
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folderPath = "public/uploads/produk_img";
    fs.mkdirSync(folderPath, { recursive: true });
    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const cleanName = req.body.nama_produk?.replace(/\s+/g, "_").toLowerCase() || "produk";
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    cb(null, `${cleanName}_${timestamp}${ext}`);
  }
});

const upload = multer({ storage }).single("photo_produk");

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

  upload(req, res, async function (err) {
    if (err) {
      console.error("❌ Upload error:", err);
      return res.status(500).send("Gagal mengunggah foto produk.");
    }

    const vendor_id = req.user.id;
    const { kategori_id, nama_produk, deskripsi_produk, harga } = req.body;
    const photo_produk = req.file ? req.file.filename : null;
    console.log("🔥 req.user:", req.user);
    console.log("📦 req.body:", req.body);
    try {
      // 1. Simpan ke produk_iklan
      const result = await pool.query(
        `INSERT INTO produk_iklan (vendor_id, kategori_id, nama_produk, deskripsi_produk, harga, status_produk, photo_produk)
       VALUES ($1, $2, $3, $4, $5, $6,$7)
       RETURNING id_produk_iklan`,
        [vendor_id, kategori_id, nama_produk, deskripsi_produk, harga, 'aktif', photo_produk]
      );

      const produkIdBaru = result.rows[0].id_produk_iklan;

      // === KATEGORI: RADIO ===
      if (kategori_id === "1") {
        const { jam_mulai, jam_selesai, hari_tayang } = req.body;

        // Gabungkan semua hari menjadi satu string dipisah koma
        const hariGabung = Array.isArray(hari_tayang) ? hari_tayang.join(",") : hari_tayang;


        await pool.query(
          `INSERT INTO jadwal_produk_radio (produk_id, hari, jam_mulai, jam_selesai)
           VALUES ($1, $2, $3, $4)`,
          [produkIdBaru, hariGabung, jam_mulai, jam_selesai]
        );

      }

      // === KATEGORI: SMS ===
      if (kategori_id === "2") {
        const { provider, jenis_target } = req.body;

        // Gabungkan semua hari menjadi satu string dipisah koma
        const providerGabung = Array.isArray(provider) ? provider.join(",") : provider;


        await pool.query(
          `INSERT INTO detail_produk_sms (produk_id, provider_yang_di_layani, jenis_target)
           VALUES ($1, $2, $3)`,
          [produkIdBaru, providerGabung, jenis_target]
        );

      }

      res.redirect("/vendor/dashboardVendor/tambahproduk");
    } catch (err) {
      console.error("Gagal simpan produk:", err);
      res.status(500).send("Terjadi kesalahan saat menyimpan produk.");
    }
  });
};

// Halaman CRUD buat produk vendor dari tabelnya
export const getProdukVendor = async (req, res) => {
  try {
    const idVendor = req.user?.id;

    if (!idVendor) {
      return res.status(403).send("Akses ditolak: ID Vendor tidak ditemukan");
    }

    const query = `
      SELECT
        produk_iklan.*,
        kategori.tipe_kategori,
        jadwal_produk_radio.hari,
        jadwal_produk_radio.jam_mulai,
        jadwal_produk_radio.jam_selesai,
        detail_produk_sms.provider_yang_di_layani,
        detail_produk_sms.jenis_target
      FROM produk_iklan
      JOIN kategori ON kategori.kategori_id = produk_iklan.kategori_id
      LEFT JOIN jadwal_produk_radio ON produk_iklan.id_produk_iklan = jadwal_produk_radio.produk_id
      LEFT JOIN detail_produk_sms ON produk_iklan.id_produk_iklan = detail_produk_sms.produk_id
      WHERE produk_iklan.vendor_id = $1
      ORDER BY produk_iklan.produk_iklan_dibuat DESC
    `;

    const hasil = await pool.query(query, [idVendor]);

    const semuaProduk = hasil.rows;

    // Filter berdasarkan kategori
    const produkRadio = semuaProduk.filter(p => p.tipe_kategori === "Radio");
    const produkSMS = semuaProduk.filter(p => p.tipe_kategori === "Messaging");


    const dataFilter = {
      radio: produkRadio,
      sms: produkSMS
    };

    console.log("📦 Produk Radio:", produkRadio.length);
    console.log("📦 Produk SMS:", produkSMS.length);

    res.render("dashVendor/dashboardVendor", {
      data: dataFilter,
      error: null,
      partial: "produk/produk_vendor_view",
    });

  } catch (err) {
    console.error("❌ Error ambil produk vendor:", err.message);
    res.status(500).send("Terjadi kesalahan server");
  }
};

export const deleteProdukRadio = async (req, res) => {
  const id = req.params.id;
  console.log("🧪 ID yang diterima:", id);

  try {
    await pool.query("BEGIN");

    // Ambil nama file fotonya dulu
    const result = await pool.query("SELECT photo_produk FROM produk_iklan WHERE id_produk_iklan = $1", [id]);
    const photoFile = result.rows[0]?.photo_produk;

    // Hapus jadwal + produk
    await pool.query("DELETE FROM jadwal_produk_radio WHERE produk_id = $1", [id]);
    await pool.query("DELETE FROM produk_iklan WHERE id_produk_iklan = $1", [id]);

    // Hapus file jika ada
    if (photoFile) {
      const filePath = path.join("public", "uploads", "produk_img", photoFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query("COMMIT");
    res.json({ success: true, message: "Produk radio berhasil dihapus." });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Gagal hapus produk radio:", err);
    res.status(500).json({ success: false, message: "Gagal menghapus produk radio." });
  }
};


export const deleteProdukSMS = async (req, res) => {
  const id = req.params.id;

  try {
    await pool.query("BEGIN");

    // Ambil nama file
    const result = await pool.query("SELECT photo_produk FROM produk_iklan WHERE id_produk_iklan = $1", [id]);
    const photoFile = result.rows[0]?.photo_produk;

    await pool.query("DELETE FROM detail_produk_sms WHERE produk_id = $1", [id]);
    await pool.query("DELETE FROM produk_iklan WHERE id_produk_iklan = $1", [id]);

    if (photoFile) {
      const filePath = path.join("public", "uploads", "produk_img", photoFile);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query("COMMIT");
    res.json({ success: true, message: "Produk SMS berhasil dihapus." });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Gagal hapus produk SMS:", err);
    res.status(500).json({ success: false, message: "Gagal menghapus produk SMS." });
  }
};

export const updateProduk = async (req, res) => {
  const id = req.params.id;

  const {
    nama_produk,
    deskripsi_produk,
    harga,
    status_produk,
    hari,              // array (khusus radio)
    jam_mulai,         // khusus radio
    jam_selesai,       // khusus radio
    provider,          // array (khusus sms)
    jenis_target       // khusus sms
  } = req.body;

  // ✅ Normalisasi agar aman meski cuma 1 nilai dikirim
  const hariArray = Array.isArray(hari) ? hari : hari ? [hari] : [];
  const providerArray = Array.isArray(provider) ? provider : provider ? [provider] : [];
  console.log("🛠️ ID Produk:", id);
  console.log("🛠️ hargaProduk:", harga);
  console.log("📥 Hari (radio):", hari);
  console.log("📥 Hari (radio):", hariArray);

  console.log("📥 Jam Mulai:", jam_mulai);
  console.log("📥 Jam Selesai:", jam_selesai);
  console.log("📥 Provider (sms):", provider);
  console.log("📥 Provider (sms):", providerArray);
  console.log("📥 Jenis Target:", jenis_target);
  try {
    await pool.query("BEGIN");

    // Update umum di produk_iklan
    await pool.query(
      `UPDATE produk_iklan SET 
        nama_produk = $1, 
        deskripsi_produk = $2, 
        harga = $3, 
        status_produk = $4 
      WHERE id_produk_iklan = $5`,
      [nama_produk, deskripsi_produk, harga, status_produk, id]
    );

    // Cek kategori produk (radio jika ada entri di jadwal)
    const cekRadio = await pool.query(`SELECT * FROM jadwal_produk_radio WHERE produk_id = $1`, [id]);
    const isRadio = cekRadio.rows.length > 0;

    if (isRadio) {
      const hariGabung = hariArray.join(",");
      await pool.query(
        `UPDATE jadwal_produk_radio 
         SET hari = $1, jam_mulai = $2, jam_selesai = $3 
         WHERE produk_id = $4`,
        [hariGabung, jam_mulai, jam_selesai, id]
      );
    } else {
      const providerGabung = providerArray.join(",");
      await pool.query(
        `UPDATE detail_produk_sms SET 
          provider_yang_di_layani = $1, 
          jenis_target = $2 
        WHERE produk_id = $3`,
        [providerGabung, jenis_target, id]
      );
    }

    await pool.query("COMMIT");
    res.json({ message: "Produk berhasil diperbarui" });

  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Error update produk:", err);
    res.status(500).json({ message: "Gagal memperbarui produk" });
  }
};


export const getOnProgressVendor = async (req, res) => {
  try {
    const vendorId = req.user.id;

    const hasil = await pool.query(`
      SELECT
  p.id_pemesanan,
  p.jumlah_pemesanan,
  p.tanggal_pemesanan,
  p.status_pemesanan,
  u.full_name, u.nomor_tlp, u.email,
  u.photo_user,
  prod.nama_produk, prod.harga, prod.photo_produk, dp.jenis_target, 
  kat.tipe_kategori,
  dps.teks_iklan_sms,
  dps.tanggal_pengiriman_start, dps.tanggal_pengiriman_end, dps.jam_pengiriman,
  dps.masking, dps.target_umur, dps.tipe_device_penerima,
  dps.nomor_penerima_bukti_tayang, dps.file_foto_mms,
  dps.file_nomor_sms_pdf, dps.alamat_target_sms, dps.dps_latitude, dps.dps_longitude
      FROM pemesanan p
      JOIN produk_iklan prod ON prod.id_produk_iklan = p.produk_id
      JOIN detail_pemesanan_sms dps ON dps.id_pemesanan = p.id_pemesanan
      JOIN users u ON u.id = p.user_id
      JOIN kategori kat ON kat.kategori_id = prod.kategori_id
      JOIN detail_produk_sms dp ON dp.produk_id = prod.id_produk_iklan
      WHERE prod.vendor_id = $1
        AND LOWER(p.status_pemesanan) != 'dibatalkan'
      ORDER BY p.tanggal_pemesanan DESC
    `, [vendorId]);

    // console.log(`✅ ${hasil.rowCount} pesanan ditemukan untuk vendor ${vendorId}`);
    // console.table(hasil.rows.map(p => ({
    //   id: p.id_pemesanan,
    //   produk: p.nama_produk,
    //   status: p.status_pemesanan,
    //   klien: p.nama_klien
    // })));

    res.render("dashVendor/dashboardVendor", {
      data: hasil.rows,
      partial: "dalam_progress",
      error: "",
      googleMapsApiKey: process.env.Maps_API
    });

  } catch (err) {
    console.error("❌ Gagal ambil data progress vendor:", err);
    res.status(500).send("Terjadi kesalahan saat mengambil data pemesanan vendor.");
  }
};



export const updateStatusPemesanan = async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  console.log("📥 ID:", id);
  console.log("📥 Status:", status);
  console.log("📥 Note:", note);

  try {
    const validStatus = ["Menunggu Pembayaran", "Menunggu Penyesuaian", "Ditolak"];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ success: false, message: "Status tidak valid." });
    }

    if (status === "Menunggu Penyesuaian") {
      if (!note || note.trim() === "") {
        return res.status(400).json({ success: false, message: "Alasan revisi wajib diisi." });
      }

      await pool.query(
        `UPDATE pemesanan SET status_pemesanan = $1, note_pemesanan_vendor = $2 WHERE id_pemesanan = $3`,
        [status, note, id]
      );
    } else {
      await pool.query(
        `UPDATE pemesanan SET status_pemesanan = $1 WHERE id_pemesanan = $2`,
        [status, id]
      );
    }

    return res.json({
      success: true,
      message: `Status berhasil diubah menjadi "${status}".`,
      updatedStatus: status,
    });
  } catch (error) {
    console.error("❌ Gagal update status pemesanan:", error);
    return res.status(500).json({ success: false, message: "Gagal update status" });
  }
};



export const generateBuktiPDF = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        p.id_pemesanan,
        p.jumlah_pemesanan,
        p.tanggal_pemesanan,
        p.status_pemesanan,
        u.full_name, u.nomor_tlp, u.email,
        u.photo_user,
        prod.nama_produk, prod.harga, prod.photo_produk, dp.jenis_target, 
        kat.tipe_kategori,
        dps.teks_iklan_sms,
        dps.tanggal_pengiriman_start, dps.tanggal_pengiriman_end, dps.jam_pengiriman,
        dps.masking, dps.target_umur, dps.tipe_device_penerima,
        dps.nomor_penerima_bukti_tayang, dps.file_foto_mms,
        dps.file_nomor_sms_pdf, dps.alamat_target_sms, dps.dps_latitude, dps.dps_longitude,
        v.nama_toko_vendor
      FROM pemesanan p
      JOIN produk_iklan prod ON prod.id_produk_iklan = p.produk_id
      JOIN detail_pemesanan_sms dps ON dps.id_pemesanan = p.id_pemesanan
      JOIN users u ON u.id = p.user_id
      JOIN kategori kat ON kat.kategori_id = prod.kategori_id
      JOIN detail_produk_sms dp ON dp.produk_id = prod.id_produk_iklan
      JOIN users_vendor v ON v.id_vendor = prod.vendor_id
      WHERE p.id_pemesanan = $1
  `, [id]);

    if (!result.rows.length) {
      return res.status(404).send("Data pemesanan tidak ditemukan.");
    }

    const p = result.rows[0];
    const toBase64 = (filePath) => {
      const image = fs.readFileSync(filePath);
      const ext = path.extname(filePath).substring(1);
      return `data:image/${ext};base64,${image.toString("base64")}`;
    };
    const safeToBase64 = (filePath) => {
      try {
        if (!filePath) return null;
        const image = fs.readFileSync(filePath);
        const ext = path.extname(filePath).substring(1);
        return `data:image/${ext};base64,${image.toString("base64")}`;
      } catch (err) {
        console.warn("⚠️ Gagal baca file gambar:", filePath);
        return null;
      }
    };
    p.logo_base64 = toBase64(path.resolve("public/foto/logo_ngiklanmurah.png"));
    // Lokasi template PDF (pastikan kamu sudah punya pdf_template.ejs di folder views)
    const templatePath = path.resolve("views/pdf_template.ejs");
    p.local_photo_produk = toBase64(path.resolve("public/uploads/produk_img", p.photo_produk));
    p.local_foto_mms = safeToBase64(
      p.file_foto_mms ? path.resolve("public/uploads/sms_files", p.file_foto_mms) : null
    );
    const html = await ejs.renderFile(templatePath, { p });

    if (!html || html.trim() === "") {
      console.error("❌ HTML kosong setelah render.");
      return res.status(500).send("Template HTML kosong.");
    }

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });

    if (!pdfBuffer || pdfBuffer.length < 1000) {
      console.error("❌ PDF buffer kosong atau gagal dibuat.");
      return res.status(500).send("PDF gagal dibuat.");
    }
    await browser.close();

    res.setHeader("Content-Disposition", `attachment; filename=bukti_pemesanan_${id}.pdf`);
    res.contentType("application/pdf");
    res.end(pdfBuffer)

  } catch (err) {
    console.error("❌ Gagal generate PDF:", err);
    res.status(500).send("Gagal membuat PDF.");
  }
};

