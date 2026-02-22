const {getPool}=require('../config/db');
const {generateDailyToken}=require('../utils/qrToken');
const crypto=require('crypto');

async function getAll(req,res){
  try{const [rows]=await getPool().query("SELECT id,name,location,created_at FROM branches ORDER BY id DESC");res.json(rows);}
  catch(err){console.error(err);res.status(500).json({message:'Server error'});}
}
async function getOne(req,res){
  try{const [[row]]=await getPool().query("SELECT id,name,location,created_at FROM branches WHERE id=?",[req.params.id]);
  if(!row) return res.status(404).json({message:'Branch not found'});res.json(row);}
  catch(err){console.error(err);res.status(500).json({message:'Server error'});}
}
async function create(req,res){
  const{name,location}=req.body;
  if(!name||!location) return res.status(400).json({message:'Name and location required'});
  const qr_secret=crypto.randomBytes(32).toString('hex');
  try{const [result]=await getPool().query("INSERT INTO branches (name,location,qr_secret) VALUES(?,?,?)",[name,location,qr_secret]);
  res.status(201).json({id:result.insertId,name,location});}
  catch(err){console.error(err);res.status(500).json({message:'Server error'});}
}
async function update(req,res){
  const{name,location}=req.body;
  try{await getPool().query("UPDATE branches SET name=?,location=? WHERE id=?",[name,location,req.params.id]);res.json({message:'Branch updated'});}
  catch(err){console.error(err);res.status(500).json({message:'Server error'});}
}
async function remove(req,res){
  try{await getPool().query("DELETE FROM branches WHERE id=?",[req.params.id]);res.json({message:'Branch deleted'});}
  catch(err){console.error(err);res.status(500).json({message:'Server error'});}
}
async function getQR(req,res){
  try{const [[branch]]=await getPool().query("SELECT id,qr_secret FROM branches WHERE id=?",[req.params.id]);
  if(!branch) return res.status(404).json({message:'Branch not found'});
  const token=generateDailyToken(branch.id,branch.qr_secret);
  const qrPayload=JSON.stringify({branch_id:branch.id,token});
  res.json({qrPayload,token});}
  catch(err){console.error(err);res.status(500).json({message:'Server error'});}
}
module.exports={getAll,getOne,create,update,remove,getQR};
