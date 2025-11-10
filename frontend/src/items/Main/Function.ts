export class Function {
    //Converte le coordinate da assolute a relative e viceversa

    public static coordinateAbsoluteToRelative(absX: number, absY: number): { x: number, y: number } {
        const relativeX = absX - 640; // Assuming 640 is half the width of the game world
        const relativeY = absY - 360; // Assuming 360 is half the height of the game world


        return { x: relativeX, y: relativeY };
    }

    public static coordinateRelativeToAbsolute(relX: number, relY: number): { x: number, y: number } {
        const absoluteX = relX + 640; // Assuming 640 is half the width of the game world
        const absoluteY = relY + 360; // Assuming 360 is half the height of the game world

        return { x: absoluteX, y: absoluteY };
    }


}

