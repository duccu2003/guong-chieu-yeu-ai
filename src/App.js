import { useEffect, useMemo, useState, } from 'react';
import Draggable from 'react-draggable';
import "react-mask-editor/dist/style.css"

import images from './images';
import UploadImage from './components/UploadImage';
import { b64toBlobUrl, blobToBase64 } from './utils/image';
import axios from 'axios';

function App() {
    const windowId = useMemo(() => Math.random(), [])
    const [loading, setLoading] = useState(true) // load images effect
    const [position, setPosition] = useState({ x: window.innerWidth / 4, y: 0 }) // relative image's postion
    const [image, setImage] = useState(images[0])
    const image1Url = image.censor // 
    const image2Url = image.uncensor
    const [index, setIndex] = useState(0) // 0: original window, 1: base image window, 2: uncensor image window

    const bc = useMemo(() => new BroadcastChannel('biya'), []);

    const handleOpenNewWindow = () => {
        // manual open is also ok 
        if (index !== 2) {
            window.open(window.location.href, '_blank',
                index === 0 ?
                `toolbar=no, menubar=no, location=yes,height=${window.innerHeight},width=${window.innerWidth},scrollbars=no,status=yes` :
                `toolbar=no, menubar=no, location=yes,height=${window.innerHeight / 4},width=${window.innerWidth / 4},scrollbars=no,status=yes`
            )
        } else {
            window.close()
        }
    }

    const handleSetImage = (img) => {
        setImage(img)
        handleOpenNewWindow()
    }

    // update and emit new position
    const updateNewPosition = ({ x, y }) => {
        bc.postMessage({ type: 'update_position', value: { x, y, windowX: window.screenX, windowY: window.screenY } })
        setPosition({ x, y })
    }

    useEffect(() => {
        bc.onmessage = (event) => {
            switch (event.data.type) {
                case 'new_tab':
                    if (index === 0) {
                        bc.postMessage({ type: 'index_1', value: event.data.value, })
                        bc.postMessage({ type: 'image', value: image })
                    } else if (index === 1) {
                        bc.postMessage({ type: 'index_2', value: event.data.value, })
                        updateNewPosition(position)
                        bc.postMessage({ type: 'image', value: image })
                    } else {
                        bc.postMessage({ type: 'index_1', value: event.data.value, })
                    }
                    break;
                case 'index_1':
                    if (event.data.value === windowId) {
                        setIndex(1)
                        document.title = image.title
                    }
                    break;
                case 'index_2':
                    if (event.data.value === windowId) {
                        setIndex(2)
                        document.title = "Gương thần"
                    }
                    break;
                case 'update_position': // sync image's position accross window
                    const { x, y, windowX, windowY } = event.data.value
                    const absoluteX = windowX + x
                    const absoluteY = windowY + y
                    setPosition({ x: absoluteX - window.screenX, y: absoluteY - window.screenY })
                    break;
                case 'image': // sync image id
                    setImage(event.data.value)
                    break;
                default:
                    break;
            }
        };

        return () => bc.onmessage = null
    }, [bc, windowId, index, image, position])

    // detect window moved
    useEffect(() => {
        var oldX = window.screenX,
            oldY = window.screenY;

        function update() {
            const deltaX = -window.screenX + oldX
            const deltaY = -window.screenY + oldY
            if (deltaX !== 0 || deltaY !== 0) {
                setPosition((prevPosition) => {
                    const newPosition = ({ x: prevPosition.x + deltaX, y: prevPosition.y + deltaY })
                    return newPosition
                })
            }
            oldX -= deltaX;
            oldY -= deltaY;
            requestAnimationFrame(update);
        }

        const interval = requestAnimationFrame(update);

        return () => cancelAnimationFrame(interval)
    }, [setPosition])

    // boarding case new_tab event
    useEffect(() => {
        bc.postMessage({ type: 'new_tab', value: windowId });
    }, [windowId])

    // loading images effect
    useEffect(() => {
        setLoading(true)
        Promise.all(
            Array.from(document.images)
            .filter(img => !img.complete)
            .map(img => new Promise(
                resolve => { img.onload = img.onerror = resolve; }
            ))).then(() => {
            setLoading(false)
        });
    }, [image])

    // img2img api
    useEffect(() => {
        if (index !== 2 || !image || !image.uncensor.startsWith("data:")) return;
        (async function() {
            try {
                const { data } = await axios({
                    url: "http://localhost:7860/sdapi/v1/img2img",
                    method: "POST",
                    data: {
                        "prompt": "art of a nude woman, naked",
                        "negative_prompt": "​​((clothing), (monochrome:1.3), (deformed, distorted, disfigured:1.3), (hair), jeans, tattoo, wet, water, clothing, shadow, 3d render, cartoon, ((blurry)), duplicate, ((duplicate body parts)), (disfigured), (poorly drawn), ((missing limbs)), logo, signature, text, words, low res, boring, artifacts, bad art, gross, ugly, poor quality, low quality, poorly drawn, bad anatomy, wrong anatomy​, ((wrinkled)),",
                        "seed": -1,
                        "steps": 20,
                        "width": 512,
                        "height": 512,
                        "denoising_strength": 0.75,
                        "n_iter": 1,
                        "init_images": [await blobToBase64(image.censor), ],
                        "mask": image.uncensor,
                        "batch_size": 1,
                        "sampler_index": "DPM++ SDE Karras",
                        "save_images": true,
                        "include_init_images": true,
                        "inpainting_mask_invert": 0, // Mask mode
                        "inpainting_fill": 0, // Masked content
                        "inpaint_full_res": 1, // Inpaint area
                    }
                })
                setImage(prevImage => ({...prevImage, uncensor: b64toBlobUrl(data.images[0]) }))
            } catch (error) {
                console.error(error)
            }
        })()
    }, [image])

    if (index === 0) return ( <
        div style = {
            { minWidth: '100vw', minHeight: '100vh', backgroundColor: '#000', color: 'white', paddingTop: '2rem' }
        } >
        <
        div className = 'container mx-auto text-center pt-2 px-1' >
        <
        div className = 'flex flex-col gap-y-2' >
        <
        h1 className = "text-4xl font-extrabold leading-none tracking-tight text-gray-900 dark:text-white uppercase mb-2 custom-heading"
        style = {
            { backgroundImage: 'linear-gradient(45deg, #ffc0cb, #ffc371)', WebkitBackgroundClip: 'text', color: 'transparent' }
        } > Gương Chiếu Yêu < /h1> <
        label
        for = "images"
        className = "block text-sm font-medium text-gray-900 dark:text-white" > Chọn ảnh < /label> <
        select id = "images"
        className = 'bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'
        value = { images.findIndex(img => img.censor === image) || -1 }
        onChange = {
            (event) => {
                setImage(images[event.target.value])
                bc.postMessage({ type: 'image', value: event.target.value })
            }
        } >
        <
        option value = { index } > { image.title || "Ảnh tự đăng" } < /option> {
        images.map((image, index) => < option value = { index } > { image.title } < /option>)
        } <
        /select> <
        button className = 'text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'
        onClick = { handleOpenNewWindow } > Mở ảnh có sẵn < /button> <
        div className = 'block text-sm font-medium text-gray-900 dark:text-white' > Hoặc < /div> <
        UploadImage setImage = { handleSetImage }
        /> < /
        div > <
        /div> < /
        div >
    )

    return ( <
        >
        {
            loading &&
            <
            div style = {
                { width: '100vw', height: '100vh', backgroundColor: '#000', color: 'white' }
            }
            className = "fixed top-0 left-0 right-0 bottom-0 w-full h-screen z-50 overflow-hidden bg-gray-700 opacity-75 flex flex-col items-center justify-center" >
            <
            div class = "loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4" > < /div> <
            h2 class = "text-center text-white text-xl font-semibold" > Đang tải... < /h2> <
            p class = "w-1/3 text-center text-white" > Đừng lóng,
            chờ 1 xíu là tải xong... < /p> < /
            div >
        } <
        div style = {
            { width: '100vw', height: '100vh', backgroundColor: '#000', color: 'white', overflow: 'hidden' }
        } >
        <
        div className = 'container mx-auto text-center pt-2 px-1' >
        <
        div className = 'flex flex-col gap-y-2' >
        <
        button className = 'text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-1.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800'
        onClick = { handleOpenNewWindow } > { index === 1 ? "Mở gương thần" : "Đóng gương thần" } <
        /button> < /
        div > <
        /div> <
        Draggable position = { position }
        onDrag = {
            (event, data) => {
                updateNewPosition({ x: data.x, y: data.y });
            }
        } >
        <
        img className = 'cursor-move max-w-[900px]'
        src = { index === 2 ? image2Url : image1Url }
        draggable = "false" / >
        <
        /Draggable> < /
        div > <
        />
    );
}

export default App;