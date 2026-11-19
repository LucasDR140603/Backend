import express from 'express'
import {pool} from '../conexion.ts'
import { adaptar, formatFecha } from '../funciones.ts'
import crypto from 'crypto'
const router=express.Router()
router.get('',async(req,res)=>{
    const query=adaptar(await pool.query('select * from proyectos where fin is null order by inicio desc'))
    res.json(query.rows)
})
router.get('/abierto-cerrado',async(req,res)=>{
    const query=adaptar(await pool.query('select * from proyectos order by inicio desc'))
    res.json(query.rows)
})
router.get('/orden-cc',async(req,res)=>{
    const query=adaptar(await pool.query('select proyectos.* from proyectos join centros on centros.id=proyectos.id_centro join clientes on clientes.id=centros.id_cliente where proyectos.fin is null order by clientes.nombre,centros.nombre,proyectos.nombre;'))
    res.json(query.rows)
})
router.get('/orden-cc/abierto-cerrado',async(req,res)=>{
    const query=adaptar(await pool.query('select proyectos.* from proyectos join centros on centros.id=proyectos.id_centro join clientes on clientes.id=centros.id_cliente order by clientes.nombre,centros.nombre,proyectos.nombre;'))
    res.json(query.rows)
})
router.get('/:id/registros',async(req,res)=>{
    const query=adaptar(await pool.query(`select * from registros where id_proyecto=$1 and (id_usuario=$2 or $3) order by inicio desc`,[req.params.id,req.user!.id,req.user!.administrador]))
    res.json(query.rows)
})
router.get('/:id/registros/ccpu',async(req,res)=>{
    const query=await pool.query(`select clientes.nombre as cliente,centros.nombre as centro,proyectos.nombre as proyecto,usuarios.nick as usuario,centros.id_cliente,proyectos.id_centro,registros.id_proyecto,registros.id_usuario,registros.id,to_char(registros.inicio,'dd/MM/yyyy hh24:mi') as inicio,to_char(registros.fin,'dd/MM/yyyy hh24:mi') as fin,registros.descripcion,registros.observaciones,registros.km,registros.desplazamiento,registros.manutencion,registros.alojamiento,(extract(epoch from (registros.fin-registros.inicio))/3600)::numeric(10,1) as duracion from registros join proyectos on registros.id_proyecto=proyectos.id join usuarios on registros.id_usuario=usuarios.id join centros on proyectos.id_centro=centros.id join clientes on centros.id_cliente=clientes.id where registros.id_proyecto=$1 and (registros.id_usuario=$2 or $3) order by inicio desc`,[req.params.id,req.user!.id,req.user!.administrador])
    res.json(query.rows)
})
router.post('',async(req,res)=>{
    const x=req.body
    x.id=x.id || crypto.randomUUID()
    x.fin=null
    x.inicio=formatFecha(new Date())
    x.fin=null
    try{
        await pool.query('insert into proyectos(id,nombre,id_centro,descripcion) values ($1,$2,$3,$4)',[x.id,x.nombre,x.id_centro,x.descripcion])
        res.json(x)
    }
    catch(err){
        res.status(403).json(err)
    }
})
router.put('',async(req,res)=>{
    const x=req.body
    try{
        await pool.query('update proyectos set nombre=$2,id_centro=$3,descripcion=$4,fin=$5 where id=$1',[x.id,x.nombre,x.id_centro,x.descripcion,x.fin])
        res.json(x)
    }
    catch(err){
        res.status(403).json(err)
    }
})
router.delete('/:id',async(req,res)=>{
    await pool.query('delete from proyectos where id=$1',[req.params.id])
    res.json('Proyecto eliminado')
})
export default router