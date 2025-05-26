import jwt from "jsonwebtoken";


// untuk admin
export const authenticateRoleDashAdmin = (roles) => {
  return (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect("/admin/login");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!roles.includes(decoded.role)) {
        return res.status(403).send("Forbidden");
      }
      req.user = decoded; // Simpan data user ke req
      next();
    } catch (err) {
      res.clearCookie("token");
      res.redirect("/admin/login");
    }
  };
};


// untuk vendor
export const authenticateVendor = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.redirect("/vendor/login"); // kalau belum login, arah login
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // tempel data vendor ke request
    next(); // lanjut ke route
  } catch (err) {
    res.clearCookie("token"); // hapus cookie token yang rusak/expired
    return res.redirect("/vendor/login");
  }
};

// untuk admin
export const authenticateRoleWeb = (roles) => {
  return (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect("/login");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!roles.includes(decoded.role)) {
        return res.status(403).send("silahkan register");
      }
      req.user = decoded; // Simpan data user ke req
      next();
    } catch (err) {
      res.clearCookie("token");
      res.redirect("/login");
    }
  };
};

// untuk vendor masih belom di pakai dan perlu di sesuaikan
// export const authenticateRoleDashVendor = (roles) => {
//   return (req, res, next) => {
//     const token = req.cookies.token;
//     if (!token) {
//       return res.redirect("/vendor/login");
//     }

//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       if (!roles.includes(decoded.role)) {
//         return res.status(403).send("Forbidden");
//       }
//       req.user = decoded; // Simpan data user ke req
//       next();
//     } catch (err) {
//       res.clearCookie("token");
//       res.redirect("/vendor/login");
//     }
//   };
// };

