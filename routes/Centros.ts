import express from 'express'
import {pool} from '../conexion.ts'
import crypto from 'crypto'
const router=express.Router()
router.get('',async(req,res)=>{
    let result=await pool.query('select centros.* from centros join clientes on clientes.id=centros.id_cliente where centros.abierto=true order by clientes.nombre,centros.nombre;')
    res.json(result.rows)
})
router.get('/abierto-cerrado',async(req,res)=>{
    let result=await pool.query('select centros.* from centros join clientes on clientes.id=centros.id_cliente order by clientes.nombre,centros.nombre;')
    res.json(result.rows)
})
router.post('',async(req,res)=>{
    const x=req.body
    x.id=x.id || crypto.randomUUID()
    x.abierto=true
    try{
        await pool.query('insert into centros values($1,$2,$3,$4);',[x.id,x.nombre,x.id_cliente,x.abierto])
        res.json(x)
    }
    catch(err){
        res.status(403).json(err)
    }
})
router.put('',async(req,res)=>{
    const x=req.body
    try{
        await pool.query('update centros set nombre=$2,id_cliente=$3,abierto=$4 where id=$1;',[x.id,x.nombre,x.id_cliente,x.abierto])
        res.json(x)
    }
    catch(err){
        res.status(403).json(err)
    }
})
router.delete('/:id',async(req,res)=>{
    await pool.query('delete from centros where id=$1',[req.params.id])
    res.json('Centro eliminado')
})
export default router