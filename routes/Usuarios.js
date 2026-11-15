import express from 'express'
import {pool} from '../conexion.js'
import multer from 'multer'
import fs from 'fs/promises'
import bcrypt from 'bcrypt'
import { comprobarClave,adaptar } from '../funciones.js'
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
const storage=multer.diskStorage({
    destination:"uploads/perfiles/",
    filename:(req,file,cb)=>{
        const nombre=crypto.randomUUID()+"-"+EXT[file.mimetype]
        cb(null,nombre)
    }
})
const upload=multer({
    storage,
    fileFilter:(req,file,cb)=>{
        if (EXT[file.mimetype]){
            cb(null,true)
        }else{
            cb(new Error('Solo se permiten imágenes'))
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } 
})
const router=express.Router()
router.get('',async(req,res)=>{
    const query=await pool.query(`select * from usuarios where operativo=true and (id=$1 or $2) order by nick`,[req.user.id,req.user.administrador])
    const filas=query.rows.map((x)=>{
        delete x.clave
        return x
    })
    res.json(filas)
})
router.get('/abierto-cerrado',async(req,res)=>{
    const query=await pool.query(`select * from usuarios where id=$1 or $2 order by nick`,[req.user.id,req.user.administrador])
    res.json(query.rows)
})
router.get('/:id/registros',async(req,res)=>{
    if (!req.user.administrador && req.user.id!=req.params.id){
        return res.status(403).json('ERROR, acceso denegado')
    }
    const query=adaptar(await pool.query('select registros.* from registros join proyectos on registros.id_proyecto=proyectos.id where id_usuario=$1 and proyectos.fin is null order by inicio desc',[req.params.id]))
    res.json(query.rows)
})
router.get('/:id/registros/abierto-cerrado',async(req,res)=>{
    if (!req.user.administrador && req.user.id!=req.params.id){
        return res.status(403).json('ERROR, acceso denegado')
    }
    const query=adaptar(await pool.query('select registros.* from registros join proyectos on registros.id_proyecto=proyectos.id where id_usuario=$1 order by inicio desc',[req.params.id]))
    res.json(query.rows)
})
router.get('/:id/registros/ccpu',async(req,res)=>{
    if (!req.user.administrador && req.user.id!=req.params.id){
        return res.status(403).json('ERROR, acceso denegado')
    }
    let result=await pool.query(`select clientes.nombre as cliente,centros.nombre as centro,proyectos.nombre as proyecto,usuarios.nick as usuario,centros.id_cliente,proyectos.id_centro,registros.id_proyecto,registros.id_usuario,registros.id,to_char(registros.inicio,'dd/MM/yyyy hh24:mi') as inicio,to_char(registros.fin,'dd/MM/yyyy hh24:mi') as fin,registros.descripcion,registros.observaciones,registros.km,registros.desplazamiento,registros.manutencion,registros.alojamiento,(extract(epoch from (registros.fin-registros.inicio))/3600)::numeric(10,1) as duracion from registros join proyectos on registros.id_proyecto=proyectos.id join usuarios on registros.id_usuario=usuarios.id join centros on proyectos.id_centro=centros.id join clientes on centros.id_cliente=clientes.id where proyectos.fin is null and registros.id_usuario=$1 order by registros.inicio desc;`,[req.params.id])
    res.json(result.rows)
})
router.get('/:id/registros/ccpu/abierto-cerrado',async(req,res)=>{
    if (!req.user.administrador && req.user.id!=req.params.id){
        return res.status(403).json('ERROR, acceso denegado')
    }
    let result=await pool.query(`select clientes.nombre as cliente,centros.nombre as centro,proyectos.nombre as proyecto,usuarios.nick as usuario,centros.id_cliente,proyectos.id_centro,registros.id_proyecto,registros.id_usuario,registros.id,to_char(registros.inicio,'dd/MM/yyyy hh24:mi') as inicio,to_char(registros.fin,'dd/MM/yyyy hh24:mi') as fin,registros.descripcion,registros.observaciones,registros.km,registros.desplazamiento,registros.manutencion,registros.alojamiento,(extract(epoch from (registros.fin-registros.inicio))/3600)::numeric(10,1) as duracion from registros join proyectos on registros.id_proyecto=proyectos.id join usuarios on registros.id_usuario=usuarios.id join centros on proyectos.id_centro=centros.id join clientes on centros.id_cliente=clientes.id where registros.id_usuario=$1 order by registros.inicio desc;`,[req.params.id])
    res.json(result.rows)
})
router.get('/:id/:id_proyecto/registros',async(req,res)=>{
    if (!req.user.administrador && req.user.id!=req.params.id){
        return res.status(403).json('ERROR, acceso denegado')
    }
    const query=adaptar(await pool.query('select registros.* from registros join proyectos on registros.id_proyecto=proyectos.id where id_usuario=$1 and id_proyecto=$2 and proyectos.fin is null order by inicio desc',[req.params.id,req.params.id_proyecto]))
    res.json(query.rows)
})
router.get('/:id/:id_proyecto/registros/ccpu',async(req,res)=>{
    if (!req.user.administrador && req.user.id!=req.params.id){
        return res.status(403).json('ERROR, acceso denegado')
    }
    const {id,id_proyecto}=req.params
    let result=await pool.query(`select clientes.nombre as cliente,centros.nombre as centro,proyectos.nombre as proyecto,usuarios.nick as usuario,centros.id_cliente,proyectos.id_centro,registros.id_proyecto,registros.id_usuario,registros.id,to_char(registros.inicio,'dd/MM/yyyy hh24:mi') as inicio,to_char(registros.fin,'dd/MM/yyyy hh24:mi') as fin,registros.descripcion,registros.observaciones,registros.km,registros.desplazamiento,registros.manutencion,registros.alojamiento,(extract(epoch from (registros.fin-registros.inicio))/3600)::numeric(10,1) as duracion from registros join proyectos on registros.id_proyecto=proyectos.id join usuarios on registros.id_usuario=usuarios.id join centros on proyectos.id_centro=centros.id join clientes on centros.id_cliente=clientes.id where registros.id_proyecto=$2 and registros.id_usuario=$1 order by registros.inicio desc;`,[id,id_proyecto])
    res.json(result.rows)
})
router.get('/proyectos',async(req,res)=>{
    const query=adaptar(await pool.query(`select p.* from proyectos p left join (select id_proyecto, max(inicio) as max_fecha from registros where id_usuario=$1 group by id_proyecto) ultimos on p.id=ultimos.id_proyecto where p.fin is null order by ultimos.max_fecha desc nulls last, p.inicio desc;`,[req.user.id]))
    res.json(query.rows)
})
router.put('/perfil',upload.single('foto'),async(req,res)=>{
    const archivo=req.file.filename
    let perfilquery=await pool.query('select perfil from usuarios where id=$1',[req.user.id])
    if (perfilquery.rows[0].perfil!=null){
        await fs.unlink(`uploads/perfiles/${perfilquery.rows[0].perfil}`)
    }
    await pool.query('update usuarios set perfil=$1 where id=$2',[archivo,req.user.id])
    res.json(archivo)
})
router.put('',async(req,res)=>{
    if (req.body.clave){
        const claves=(await pool.query(`select clave from usuarios where id!=$1`,[req.body.id])).rows
        if (claves.length>0){
            const comparaciones=claves.map((x)=>bcrypt.compare(req.body.clave,x.clave))
            var repeticiones=await Promise.all(comparaciones)
            if (repeticiones.includes(true)){
                return res.status(403).json("Contraseña repetida")
            }
        }
    }
    let x=req.body
    let anterior=(await pool.query(`select * from usuarios where id=$1`,[x.id])).rows[0]
    if (req.user.id==x.id){
        x.operativo=anterior.operativo
        x.administrador=anterior.administrador
        x.clave=x.clave!=null?(await bcrypt.hash(x.clave,10)):anterior.clave
    }
    else{
        if (!req.user.administrador){
            x=anterior
        }
        else{
            x={...anterior,administrador:x.administrador,operativo:x.operativo}
        }
    }
    await pool.query(`update usuarios set nombre=$2,apellido1=$3,apellido2=$4,nick=$5,clave=$6,email=$7,telefono=$8,administrador=$9,operativo=$10 where id=$1;`,[x.id,x.nombre,x.apellido1,x.apellido2,x.nick,x.clave,x.email,x.telefono,x.administrador,x.operativo])
    res.json('Usuario actualizado')
})
router.put('/:campo',async(req,res)=>{
    const permitidos=['nombre','apellido1','apellido2','nick','clave','email','telefono']
    let campo=req.params.campo
    if (!permitidos.includes(campo.toLowerCase())){
        return res.status(403).json('Campo no actualizable desde este endpoint')
    }
    let valor=req.body.valor
    if (campo.toLowerCase()=='clave'){
        if (!comprobarClave(valor)){
            return res.status(403).json('Contraseña no válida')
        }
        const claves=(await pool.query(`select clave from usuarios where id!=$1`,[req.user.id])).rows
        if (claves.length>0){
            const comparaciones=claves.map((x)=>bcrypt.compare(valor,x.clave))
            var repeticiones=await Promise.all(comparaciones)
            if (repeticiones.includes(true)){
                return res.status(403).json("Contraseña repetida")
            }
        }
        valor=await bcrypt.hash(valor,10)
    }
    await pool.query(`update usuarios set ${campo.toLowerCase()}=$1 where id=$2;`,[valor,req.user.id])
    res.json('Usuario actualizado')
})
router.delete('/:id',async(req,res)=>{
    if (req.params.id==req.user.id || !req.user.administrador){
        return res.status(403).json("ERROR, permiso denegado")
    }
    await pool.query('delete from usuarios where id=$1',[req.params.id])
    res.json('Usuario eliminado')
})
export default router