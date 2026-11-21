import express from 'express'
import {pool} from '../conexion.ts'
import {adaptar} from '../funciones.ts'
import crypto from 'crypto'
const router=express.Router()
router.get('',async(req,res)=>{
    const query=adaptar(await pool.query(`select registros.* from registros join proyectos on registros.id_proyecto=proyectos.id join usuarios on registros.id_usuario=usuarios.id where proyectos.fin is null and usuarios.operativo=true and (registros.id_usuario=$1 or $2) order by registros.inicio desc;`,[req.user!.id,req.user!.administrador]))
    res.json(query.rows)
})
router.get('/ccpu',async(req,res)=>{
    const query=await pool.query(`select clientes.nombre as cliente,centros.nombre as centro,proyectos.nombre as proyecto,usuarios.nick as usuario,centros.id_cliente,proyectos.id_centro,registros.id_proyecto,registros.id_usuario,registros.id,to_char(registros.inicio,'dd/MM/yyyy hh24:mi') as inicio,to_char(registros.fin,'dd/MM/yyyy hh24:mi') as fin,registros.descripcion,registros.observaciones,registros.km,registros.desplazamiento,registros.manutencion,registros.alojamiento,(extract(epoch from (registros.fin-registros.inicio))/3600)::numeric(10,1) as duracion from registros join proyectos on registros.id_proyecto=proyectos.id join usuarios on registros.id_usuario=usuarios.id join centros on proyectos.id_centro=centros.id join clientes on centros.id_cliente=clientes.id where proyectos.fin is null and usuarios.operativo=true and (registros.id_usuario=$1 or $2) order by registros.inicio desc;`,[req.user!.id,req.user!.administrador])
    res.json(query.rows)
})
router.post('',async(req,res)=>{
    const x=req.body
    x.id=x.id || crypto.randomUUID()
    if (x.id_usuario!=req.user!.id){
        return res.status(403).json('Acceso denegado')
    }
    await pool.query('insert into registros values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);',[x.id,x.id_proyecto,x.inicio,x.fin,x.descripcion,x.observaciones,x.id_usuario,x.km,x.desplazamiento,x.manutencion,x.alojamiento])
    res.json('Registro añadido')
})
router.put('',async(req,res)=>{
    const x=req.body
    const [check]=(await pool.query('select ((select id_usuario from registros where id=$1)=$2) as suyo',[x.id,req.user!.id])).rows
    if (!check.suyo || x.id_usuario!=req.user!.id){
        return res.status(403).json('Acceso denegado')
    }
    await pool.query('update registros set id_proyecto=$2,inicio=$3,fin=$4,descripcion=$5,observaciones=$6,id_usuario=$7,km=$8,desplazamiento=$9,manutencion=$10,alojamiento=$11 where id=$1;',[x.id,x.id_proyecto,x.inicio,x.fin,x.descripcion,x.observaciones,x.id_usuario,x.km,x.desplazamiento,x.manutencion,x.alojamiento])
    res.json('Registro editado')
})
router.delete('/:id',async(req,res)=>{
    const query=await pool.query('select id_usuario from registros where id=$1;',[req.params.id])
    if (query.rows.length==0 || query.rows[0].id_usuario!=req.user!.id){
        return res.status(403).json('Acceso denegado')
    }
    await pool.query('delete from registros where id=$1;',[req.params.id])
    res.json('Registro eliminado')
})
export default router