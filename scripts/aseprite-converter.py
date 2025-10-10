#!/usr/bin/env python3
import sys
import subprocess
import importlib

#libs check, just ignore it
REQUIRED_LIBS = [
    "PIL",
    "tqdm"
]

def ensure_dependencies():
    for lib in REQUIRED_LIBS:
        try:
            importlib.import_module(lib if lib != "PIL" else "PIL.Image")
        except ImportError:
            print(f"Libreria '{lib}' non trovata. Installazione in corso...")
            install_name = "pillow" if lib == "PIL" else lib.lower()
            subprocess.check_call([sys.executable, "-m", "pip", "install", install_name])

    for lib in REQUIRED_LIBS:
        importlib.import_module(lib if lib != "PIL" else "PIL.Image")
ensure_dependencies()

import os
import platform
from PIL import Image
import re
from tqdm import tqdm

#Main
def main(source, store, removeBG, tolerance):
    print(source, "\n", store)
    dir = os.listdir(source)
    if len(dir) == 0:  # Is it empty?
        print(f"{source} non contiene nessun file")
        return

    dir = selectAseprite(dir)
    for file in tqdm(dir, desc="Conversione", unit="file"):
        #print(f"{source + file}\nvvvvvvvvvvvvvvv\n{store + file.split(".")[0] + '.png'}\n") #DEBUG
        convert(source + file, store + file.split(".")[0] + ".png")
        if removeBG:
            if os.path.exists(store + file.split(".")[0] + ".png"):
                eraseBG(store + file.split(".")[0] + ".png", tolerance)
            else:
                i = 1
                while os.path.exists(store + file.split(".")[0] + str(i) +".png"):
                    eraseBG(store + file.split(".")[0] + str(i) +".png", tolerance)
                    i += 1

#Select only .aseprite
def selectAseprite(source):
    tmp = []
    for file in source:
        if file[0] == ".":              #Ignore hidden files
            continue
        if file[-8:] == "aseprite":     #Select only asprite files
            tmp.append(file)
    return tmp

#Cross-platform (maybe) process to convert the files
def convert(source, store):
    os_name = platform.system()
    
    if os_name == "Darwin":
        aseprite_path = "/Applications/Aseprite.app/Contents/MacOS/aseprite"
    elif os_name == "Linux":
        aseprite_path = "aseprite"
    elif os_name == "Windows":                                #BLEAH >:( 
        aseprite_path = r"C:\Program Files\Aseprite\Aseprite.exe"
    else:
        print(f"Ma che minchia di OS stai usando???")
        return
    
    while True:
        try:
            subprocess.run([aseprite_path, "-b", source, "--save-as", store], check=True)
            break
        except FileNotFoundError:
            print(f"Eseguibile Aseprite non trovato: {aseprite_path}")
            user_input = input("Inserisci il percorso completo dell'eseguibile aseprite o 'Q' per uscire: ")
            if user_input.lower() == "q":
                return
            aseprite_path = user_input
        except subprocess.CalledProcessError as e:
            print(f"Errore durante la conversione: {e}")
            break

#Remove the background
def eraseBG(file, tolerance):
    input_image = Image.open(file).convert("RGBA")
    pixels = input_image.load()
    width, height = input_image.size

    for i in range(width):
        for j in range(height):
            r, g, b, a = pixels[i, j]
            if r <= tolerance and g <= tolerance and b <= tolerance:
                pixels[i, j] = (0, 0, 0, 0)

    input_image.save(file)

# example:
# ./aseprite-converter.py /Users/RobertoBenigni/fotoPiedi/ /Users/GianniMorandi/piattiDiMerda/ -t=100

if __name__ == "__main__":
    removeBG = True
    tolerance = 12
    debug = False

    if "-k" in sys.argv:                            #Keep the background?
        sys.argv.remove("-k")
        removeBG = False

    if "-d" in sys.argv:                            #Don't mind me :3
        sys.argv.remove("-d")
        debug = True    

    token_pattern = re.compile(r"-t=(\d+)")         #Change the tolerance?
    new_argv = []
    for arg in sys.argv:
        match = token_pattern.fullmatch(arg)
        if match:
            value = int(match.group(1))
            if 0 <= value <= 255:
                tolerance = value
            else:
                print("Errore: il valore di -t deve essere tra 0 e 255.")
                sys.exit(1)
        else:
            new_argv.append(arg)
    sys.argv = new_argv

    #I/O check
    if len(sys.argv) < 2:
        source = input("Specificare la directory in cui si trovano i file .aseprite: ").replace("'", "").replace(" ", "")
    else:
        source = sys.argv[1].replace("'", "").replace(" ", "")
    source = source + "/" if source[-1] != "/" else source

    if (not os.path.exists(source)):
        print(f"Directory {source} inesistente")
        exit()

    if len(sys.argv) < 3:
        store = input("Specificare la directory in cui salvare i file .png: ").replace("'", "").replace(" ", "")
    else:
        store = sys.argv[2].replace("'", "").replace(" ", "")
    store = store + "/" if store[-1] != "/" else store

    if (not os.path.exists(store)):
        choice = input(f"Directory {store} inesistente, crearla? (S/n): ").lower()
        if choice == "n":
            exit()
        os.makedirs(store)

    main(source, store, removeBG, tolerance)