package com.github.madbrain.recettelang;

import org.eclipse.lsp4j.Position;
import org.eclipse.lsp4j.Range;

public class PositionUtils {
    public static boolean isInside(Position position, Range range) {
        return isAfterEquals(position, range.getStart())
                && isBeforeEquals(position, range.getEnd());
    }

    public static boolean isBeforeEquals(Position position, Position other) {
        if (position.getLine() > other.getLine()) {
            return false;
        }
        if (position.getLine() < other.getLine()) {
            return true;
        }
        return position.getCharacter() <= other.getCharacter();
    }

    public static boolean isAfterEquals(Position position, Position other) {
        if (position.getLine() < other.getLine()) {
            return false;
        }
        if (position.getLine() > other.getLine()) {
            return true;
        }
        return position.getCharacter() >= other.getCharacter();
    }
}
