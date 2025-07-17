import cron from "node-cron";
import pool from "../../db.js";


// buat merubah pembayaran
// Cron seting 1 menit
// cron.schedule("*/1 * * * *", async () => {
// Cron akan berjalan setiap jam
cron.schedule("0 * * * *", async () => {
  console.log("🔄 Cek status pemesanan yang kadaluwarsa pembayaran...");

    const batasWaktu = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 jam ke belakang
    // const batasWaktu = new Date(Date.now() - 1 * 60 * 1000); // 1 menut
  try {
    const result = await pool.query(`
      UPDATE pemesanan
      SET status_pemesanan = 'Melewati Batas Waktu Pembayaran', tanggal_disetujui = NULL
      WHERE status_pemesanan = 'Menunggu Pembayaran' AND tanggal_disetujui IS NOT NULL
      AND tanggal_disetujui < $1
      RETURNING id_pemesanan
    `, [batasWaktu]);

    if (result.rowCount > 0) {
      console.log(`🚫 ${result.rowCount} pemesanan dibatalkan karena melewati batas waktu pembayaran.`);
    } else {
      console.log("✅ Tidak ada pemesanan yang melewati batas waktu.");
    }
  } catch (err) {
    console.error("❌ Gagal menjalankan cron job:", err);
  }
});

cron.schedule("0 * * * *", async () => {
  console.log("🔄 Cek status pemesanan yang kadaluwarsa pembayaran...");

    const batasWaktu = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 jam ke belakang
    
  try {
    const result = await pool.query(`
      UPDATE pemesanan
      SET status_pemesanan = 'Melewati Batas Waktu Pembayaran', tanggal_disetujui = NULL
      WHERE status_pemesanan = 'jumlah pembayaran tidak sesuai' AND tanggal_disetujui IS NOT NULL
      AND tanggal_disetujui < $1
      RETURNING id_pemesanan
    `, [batasWaktu]);

    if (result.rowCount > 0) {
      console.log(`🚫 ${result.rowCount} pemesanan dibatalkan karena melewati batas waktu pembayaran.`);
    } else {
      console.log("✅ Tidak ada pelunasan yang melewati batas waktu.");
    }
  } catch (err) {
    console.error("❌ Gagal menjalankan cron job:", err);
  }
});

// buat merubah pada bukti tayang yang uda di kirim +2hari dari tanggal tayang terakhir
cron.schedule('0 1 * * *', async () => {
  console.log('⏰ Memulai pengecekan otomatis status selesai...');

  try {
    const now = new Date();
    const duaHariLalu = new Date(now.setDate(now.getDate() - 2));

    // ✅ Untuk kategori radio
    await pool.query(`
      UPDATE pemesanan
      SET status_pemesanan = 'Selesai'
      WHERE kategori_id IN (
        SELECT kategori_id FROM kategori WHERE tipe_kategori = 'radio'
      )
      AND status_pemesanan = 'Menunggu Konfirmasi Klien'
      AND id_pemesanan IN (
        SELECT id_pemesanan FROM detail_pemesanan_radio
        GROUP BY id_pemesanan
        HAVING MAX(tanggal_tayang_pemesanan_radio) <= $1
      )
    `, [duaHariLalu]);

    // ✅ Untuk kategori messaging
    await pool.query(`
      UPDATE pemesanan
      SET status_pemesanan = 'Selesai'
      WHERE kategori_id IN (
        SELECT kategori_id FROM kategori WHERE tipe_kategori = 'messaging'
      )
      AND status_pemesanan = 'Menunggu Konfirmasi Klien'
      AND id_pemesanan IN (
        SELECT id_pemesanan FROM detail_pemesanan_sms
        WHERE tanggal_pengiriman_end <= $1
      )
    `, [duaHariLalu]);

    console.log('✅ Status otomatis diubah jadi Selesai!');
  } catch (err) {
    console.error('❌ Gagal menjalankan cron selesai:', err);
  }
});
