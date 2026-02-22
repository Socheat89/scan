const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const {getPool}=require('../config/db');

async function login(req,res){
  const {email,password}=req.body;
  if(!email||!password) return res.status(400).json({message:'Email and password required'});
  try {
    const pool=getPool();
    const [[user]]=await pool.query("SELECT u.*,b.name AS branch_name FROM users u LEFT JOIN branches b ON b.id=u.branch_id WHERE u.email=?",[email]);
    if(!user) return res.status(401).json({message:'Invalid credentials'});
    const match=await bcrypt.compare(password,user.password);
    if(!match) return res.status(401).json({message:'Invalid credentials'});
    const payload={id:user.id,name:user.name,email:user.email,role:user.role,branch_id:user.branch_id};
    const token=jwt.sign(payload,process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||'7d'});
    res.json({token,user:{...payload,branch_name:user.branch_name}});
  } catch(err){console.error(err);res.status(500).json({message:'Server error'});}
}
module.exports={login};
