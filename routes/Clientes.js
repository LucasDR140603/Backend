import express from 'express'
import { pool } from '../conexion.js'
import crypto from 'crypto'
const router=express.Router()
router.get('',async(req,res)=>{
    res.json((await pool.query(`select * from clientes where abierto=true order by nombre`)).rows)
})
router.get('/abierto-cerrado',async(req,res)=>{
    res.json((await pool.query('select * from clientes order by nombre')).rows)
})
router.post('',async(req,res)=>{
    const x=req.body
    x.id=x.id || crypto.randomUUID()
    x.abierto=true
    try{
        await pool.query(`insert into clientes values ($1,$2,$3)`,[x.id,x.nombre,x.abierto])
        res.json(x)
    }
    catch(err){
        res.status(403).json(err)
    }
})
router.put('',async(req,res)=>{
    const x=req.body
    try{
        await pool.query(`update clientes values set nombre=$2,abierto=$3 where id=$1`,[x.id,x.nombre,x.abierto])
        res.json(x)
    }
    catch(err){
        res.status(403).json(err)
    }
})
router.delete('/:id',async(req,res)=>{
    let result=await pool.query(`delete from clientes where id=$1;`,[req.params.id])
    res.json(result.rowCount)
})
export default router