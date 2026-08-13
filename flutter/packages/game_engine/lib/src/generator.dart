import 'package:poko_game_engine/src/difficulty.dart';
import 'package:poko_game_engine/src/num.dart';
import 'package:poko_game_engine/src/rng.dart';
import 'package:poko_game_engine/src/types.dart';
import 'package:poko_game_engine/src/validator.dart';

const _defaultBands = <BandId, BandConfig>{
  BandId.sprout: BandConfig(
    id: BandId.sprout,
    numberRange: IntRange(1, 10),
    allowedOperations: <Operation>[Operation.add, Operation.sub],
    allowedColours: <TileColour>[TileColour.coral, TileColour.marine],
    minChain: 2,
    maxChain: 4,
    maxTarget: 20,
    allowNegatives: false,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 4,
  ),
  BandId.adventurer: BandConfig(
    id: BandId.adventurer,
    numberRange: IntRange(1, 12),
    allowedOperations: <Operation>[Operation.add, Operation.sub, Operation.mul],
    allowedColours: <TileColour>[
      TileColour.coral,
      TileColour.marine,
      TileColour.kelp,
    ],
    minChain: 2,
    maxChain: 5,
    maxTarget: 50,
    allowNegatives: false,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 5,
  ),
  BandId.challenger: BandConfig(
    id: BandId.challenger,
    numberRange: IntRange(1, 12),
    allowedOperations: <Operation>[
      Operation.add,
      Operation.sub,
      Operation.mul,
      Operation.div,
    ],
    allowedColours: <TileColour>[
      TileColour.coral,
      TileColour.marine,
      TileColour.kelp,
      TileColour.sunfish,
    ],
    minChain: 2,
    maxChain: 5,
    maxTarget: 100,
    allowNegatives: false,
    allowDiagonals: false,
    minSolutions: 1,
    maxSolutions: 5,
  ),
  BandId.trailblazer: BandConfig(
    id: BandId.trailblazer,
    numberRange: IntRange(1, 15),
    allowedOperations: <Operation>[
      Operation.add,
      Operation.sub,
      Operation.mul,
      Operation.div,
    ],
    allowedColours: <TileColour>[
      TileColour.coral,
      TileColour.marine,
      TileColour.kelp,
      TileColour.sunfish,
    ],
    minChain: 2,
    maxChain: 6,
    maxTarget: 150,
    allowNegatives: false,
    allowDiagonals: true,
    minSolutions: 1,
    maxSolutions: 6,
  ),
  BandId.pathfinder: BandConfig(
    id: BandId.pathfinder,
    numberRange: IntRange(1, 20),
    allowedOperations: <Operation>[
      Operation.add,
      Operation.sub,
      Operation.mul,
      Operation.div,
      Operation.wild,
    ],
    allowedColours: <TileColour>[
      TileColour.coral,
      TileColour.marine,
      TileColour.kelp,
      TileColour.sunfish,
      TileColour.violet,
    ],
    minChain: 2,
    maxChain: 6,
    maxTarget: 200,
    allowNegatives: true,
    allowDiagonals: true,
    minSolutions: 1,
    maxSolutions: 8,
  ),
};

final class GuaranteedSolution {
  const GuaranteedSolution({
    required this.operation,
    required this.colour,
    required this.left,
    required this.right,
    required this.target,
  });

  final Operation operation;
  final TileColour colour;
  final int left;
  final int right;
  final Num target;
}

BandConfig defaultBand(BandId bandId) => _defaultBands[bandId]!;

({Operation operation, TileColour colour}) _operationSlot(
  Rng rng,
  BandConfig band,
) {
  final slotCount = _max(
    1,
    _min(band.allowedOperations.length, band.allowedColours.length),
  );
  final slot = rng.nextInt(0, slotCount - 1);
  return (
    operation: band.allowedOperations[slot],
    colour: band.allowedColours[slot],
  );
}

GuaranteedSolution chooseGuaranteedSolution(Rng rng, BandConfig band) {
  final minimum = band.numberRange.min;
  final maximum = band.numberRange.max;
  for (var attempt = 0; attempt < 64; attempt += 1) {
    final slot = _operationSlot(rng, band);
    final candidateOperation = slot.operation == Operation.wild
        ? Operation.add
        : slot.operation;
    var left = rng.nextInt(minimum, maximum);
    var right = rng.nextInt(minimum, maximum);
    late final int target;

    switch (candidateOperation) {
      case Operation.add:
      case Operation.wild:
        target = left + right;
      case Operation.sub:
        if (!band.allowNegatives && left < right) {
          final swapped = left;
          left = right;
          right = swapped;
        }
        target = left - right;
      case Operation.mul:
        target = left * right;
      case Operation.div:
        final quotient = rng.nextInt(_max(1, minimum), _max(1, maximum));
        right = rng.nextInt(_max(1, minimum), _max(1, maximum));
        left = quotient * right;
        target = quotient;
        if (left > maximum) {
          continue;
        }
    }

    if ((!band.allowNegatives && target < 0) || target > band.maxTarget) {
      continue;
    }
    return GuaranteedSolution(
      operation: slot.operation,
      colour: slot.colour,
      left: left,
      right: right,
      target: integer(target),
    );
  }
  throw RangeError('band ${band.id.name} cannot produce a legal target');
}

GuaranteedSolution? solutionForTarget(
  Rng rng,
  BandConfig band,
  int targetValue,
) {
  if (targetValue > band.maxTarget ||
      (targetValue < 0 && !band.allowNegatives)) {
    return null;
  }
  final minimum = band.numberRange.min;
  final maximum = band.numberRange.max;
  final slotCount = _max(
    1,
    _min(band.allowedOperations.length, band.allowedColours.length),
  );
  final slots = rng.shuffle(List<int>.generate(slotCount, (index) => index));
  for (final slot in slots) {
    final operation = band.allowedOperations[slot];
    final colour = band.allowedColours[slot];
    final effective = operation == Operation.wild ? Operation.add : operation;
    final pairs = <(int, int)>[];
    for (var left = minimum; left <= maximum; left += 1) {
      int? right;
      switch (effective) {
        case Operation.add:
        case Operation.wild:
          right = targetValue - left;
        case Operation.sub:
          right = left - targetValue;
        case Operation.mul:
          right = left != 0 && targetValue % left == 0
              ? targetValue ~/ left
              : null;
        case Operation.div:
          right = targetValue != 0 && left % targetValue == 0
              ? left ~/ targetValue
              : null;
      }
      if (right == null || right < minimum || right > maximum) {
        continue;
      }
      if (effective == Operation.div && right == 0) {
        continue;
      }
      pairs.add((left, right));
    }
    final chosenIndex = rng.nextInt(0, _max(0, pairs.length - 1));
    if (pairs.isNotEmpty) {
      final chosen = pairs[chosenIndex];
      return GuaranteedSolution(
        operation: operation,
        colour: colour,
        left: chosen.$1,
        right: chosen.$2,
        target: integer(targetValue),
      );
    }
  }
  return null;
}

Tile randomTile(Rng rng, BandConfig band, String id) {
  final slot = _operationSlot(rng, band);
  final value = rng.nextInt(band.numberRange.min, band.numberRange.max);
  return Tile(
    id: id,
    value: integer(value),
    colour: slot.colour,
    operation: slot.operation,
    ownOperator: slot.operation == Operation.wild ? Operation.add : null,
  );
}

const int _nearMissPercent = 85;
const int _maxSteeredRun = 3;
const int _decoyTuneAttempts = 12;

bool _isNearMiss(BandConfig band, Num target, Tile anchor, int value) {
  if (!target.isInteger || !anchor.value.isInteger) {
    return false;
  }
  final operation = anchor.operation == Operation.wild
      ? (anchor.ownOperator ?? Operation.add)
      : anchor.operation;
  late final int result;
  switch (operation) {
    case Operation.add:
    case Operation.wild:
      result = anchor.value.numerator + value;
    case Operation.sub:
      result = anchor.value.numerator - value;
    case Operation.mul:
      result = anchor.value.numerator * value;
    case Operation.div:
      if (value == 0 || anchor.value.numerator % value != 0) {
        return false;
      }
      result = anchor.value.numerator ~/ value;
  }
  if ((!band.allowNegatives && result < 0) || result > band.maxTarget) {
    return false;
  }
  final distance = (result - target.numerator).abs();
  return distance > 0 && distance <= decoyNearDistance;
}

Tile? nearMissTile(
  Rng rng,
  BandConfig band,
  Num target,
  List<Tile> anchors,
  String id,
) {
  if (anchors.isEmpty) {
    return null;
  }
  final groups = <List<Tile>>[];
  for (final anchor in anchors) {
    List<Tile>? existing;
    for (final group in groups) {
      if (group.first.colour == anchor.colour) {
        existing = group;
        break;
      }
    }
    if (existing == null) {
      groups.add(<Tile>[anchor]);
    } else {
      existing.add(anchor);
    }
  }
  var group = groups.first;
  for (final candidate in groups) {
    if (candidate.length > group.length) {
      group = candidate;
    }
  }
  final lead = group.first;
  final candidates = <int>[];
  var bestHits = 0;
  for (
    var value = band.numberRange.min;
    value <= band.numberRange.max;
    value += 1
  ) {
    var hits = 0;
    for (final anchor in group) {
      if (_isNearMiss(band, target, anchor, value)) {
        hits += 1;
      }
    }
    if (hits == 0) {
      continue;
    }
    if (hits > bestHits) {
      bestHits = hits;
      candidates.clear();
    }
    if (hits == bestHits) {
      candidates.add(value);
    }
  }
  if (candidates.isEmpty) {
    return null;
  }
  final best = candidates[rng.nextInt(0, candidates.length - 1)];
  return Tile(
    id: id,
    value: integer(best),
    colour: lead.colour,
    operation: lead.operation,
    ownOperator: lead.operation == Operation.wild ? Operation.add : null,
  );
}

int _runLength(
  List<List<Tile>> rows,
  List<Tile> current,
  int row,
  int col,
  TileColour colour,
  int rowDelta,
  int colDelta,
) {
  var length = 0;
  var scanRow = row - rowDelta;
  var scanCol = col - colDelta;
  while (length < _maxSteeredRun) {
    Tile? tile;
    if (scanRow == row) {
      if (scanCol >= 0 && scanCol < current.length) {
        tile = current[scanCol];
      }
    } else if (scanRow >= 0 &&
        scanRow < rows.length &&
        scanCol >= 0 &&
        scanCol < rows[scanRow].length) {
      tile = rows[scanRow][scanCol];
    }
    if (tile == null || tile.colour != colour) {
      break;
    }
    length += 1;
    scanRow -= rowDelta;
    scanCol -= colDelta;
  }
  return length;
}

bool shouldNearMiss(Rng rng) => rng.nextInt(0, 99) < _nearMissPercent;

(Tile, Tile) solutionTiles(GuaranteedSolution solution, String idPrefix) {
  final ownOperator = solution.operation == Operation.wild
      ? Operation.add
      : null;
  return (
    Tile(
      id: '$idPrefix-a',
      value: integer(solution.left),
      colour: solution.colour,
      operation: solution.operation,
      ownOperator: ownOperator,
    ),
    Tile(
      id: '$idPrefix-b',
      value: integer(solution.right),
      colour: solution.colour,
      operation: solution.operation,
      ownOperator: ownOperator,
    ),
  );
}

(Cell, Cell) _solutionCells(Rng rng) {
  final horizontal = rng.nextInt(0, 1) == 0;
  if (horizontal) {
    final row = rng.nextInt(0, 7);
    final col = rng.nextInt(0, 6);
    return (Cell(row: row, col: col), Cell(row: row, col: col + 1));
  }
  final row = rng.nextInt(0, 6);
  final col = rng.nextInt(0, 7);
  return (Cell(row: row, col: col), Cell(row: row + 1, col: col));
}

List<List<Tile>> _fillDecoyBoard(
  Rng rng,
  BandConfig band,
  Num target,
  int seed,
) {
  final tiles = <List<Tile>>[];
  for (var row = 0; row < 8; row += 1) {
    final current = <Tile>[];
    for (var col = 0; col < 8; col += 1) {
      final id = '$seed-$row-$col';
      final previous = row > 0 ? tiles[row - 1] : null;
      final anchors = <Tile>[];
      if (col > 0) {
        anchors.add(current[col - 1]);
      }
      if (previous != null && col < previous.length) {
        anchors.add(previous[col]);
      }
      if (band.allowDiagonals && previous != null) {
        if (col > 0) {
          anchors.add(previous[col - 1]);
        }
        if (col + 1 < previous.length) {
          anchors.add(previous[col + 1]);
        }
      }
      final steered = anchors.isNotEmpty && shouldNearMiss(rng)
          ? nearMissTile(rng, band, target, anchors, id)
          : null;
      final extendsRun =
          steered != null &&
          (_runLength(tiles, current, row, col, steered.colour, 0, 1) >=
                  _maxSteeredRun ||
              _runLength(tiles, current, row, col, steered.colour, 1, 0) >=
                  _maxSteeredRun);
      current.add(
        extendsRun || steered == null ? randomTile(rng, band, id) : steered,
      );
    }
    tiles.add(current);
  }
  return tiles;
}

({Board board, Num target, int rngState}) _createBoard(
  int seed,
  BandConfig band,
) {
  final normalisedSeed = seed & 0xffffffff;
  final rng = Rng(normalisedSeed);
  List<List<Tile>>? bestTiles;
  Num? bestTarget;
  var bestRatio = -1.0;
  for (var attempt = 0; attempt < _decoyTuneAttempts; attempt += 1) {
    final solution = chooseGuaranteedSolution(rng, band);
    final tiles = _fillDecoyBoard(rng, band, solution.target, normalisedSeed);
    final cells = _solutionCells(rng);
    final guaranteed = solutionTiles(solution, '$normalisedSeed-solution');
    tiles[cells.$1.row][cells.$1.col] = guaranteed.$1;
    tiles[cells.$2.row][cells.$2.col] = guaranteed.$2;
    final candidate = Board(
      width: 8,
      height: 8,
      tiles: tiles.map((row) => List<Tile?>.of(row)).toList(),
      seed: normalisedSeed,
    );
    final ratio = decoyQuality(candidate, solution.target, band).ratio;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestTiles = tiles;
      bestTarget = solution.target;
    }
    if (ratio >= decoyNearRatio) {
      break;
    }
  }
  return (
    board: Board(
      width: 8,
      height: 8,
      tiles: (bestTiles ?? <List<Tile>>[])
          .map((row) => List<Tile?>.of(row))
          .toList(),
      seed: normalisedSeed,
    ),
    target: bestTarget ?? Num.zero,
    rngState: rng.state,
  );
}

LevelState createInitialState(int seed, LevelRules rules, BandConfig band) {
  final generated = _createBoard(seed, band);
  return LevelState(
    phase: Phase.ready,
    board: generated.board,
    target: generated.target,
    chain: const Chain(cells: <Cell>[]),
    preview: null,
    score: 0,
    combo: 0,
    movesUsed: 0,
    movesRemaining: rules.moveLimit,
    timeRemainingMs: rules.timeLimitMs,
    solvedCount: 0,
    attemptCount: 0,
    hintsUsed: 0,
    rules: rules,
    band: band,
    rngState: generated.rngState,
    history: const <GameAction>[],
  );
}

LevelRules _packRules(BandConfig band) => LevelRules(
  objective: ObjectiveType.equationCount,
  goalValue: 10,
  moveLimit: 20,
  obstacles: const <ObstacleCount>[],
  allowedPowerUps: const <PowerUpId>[
    PowerUpId.hintLens,
    PowerUpId.equationShuffle,
  ],
  targetSkills: <String>['${band.id.name}.mixed'],
);

List<PuzzleSeed> generatePackInternal(BandId bandId, int count, int seed) {
  if (count <= 0) {
    return <PuzzleSeed>[];
  }
  final band = defaultBand(bandId);
  final result = <PuzzleSeed>[];
  final usedSeeds = <int>{};
  for (var index = 0; index < count; index += 1) {
    final firstCandidate = (seed + _imul(index, 0x9e3779b9)) & 0xffffffff;
    final rules = _packRules(band);
    var puzzleSeed = firstCandidate;
    ValidationResult? validation;
    for (var attempt = 0; attempt < 512; attempt += 1) {
      puzzleSeed = (firstCandidate + attempt) & 0xffffffff;
      if (usedSeeds.contains(puzzleSeed)) {
        continue;
      }
      final candidate = createInitialState(puzzleSeed, rules, band);
      validation = validatePuzzle(
        candidate.board,
        candidate.target,
        rules,
        band,
      );
      if (validation.valid) {
        break;
      }
    }
    if (validation == null || !validation.valid) {
      throw StateError('could not generate a valid ${band.id.name} puzzle');
    }
    usedSeeds.add(puzzleSeed);
    result.add(
      PuzzleSeed(
        id: '${band.id.name}-${puzzleSeed.toRadixString(36)}',
        seed: puzzleSeed,
        band: band.id,
        rules: rules,
        difficultyScore: difficultyScore(band, rules, validation.analysis),
        validation: PuzzleValidation(
          solutionCount: validation.analysis.solutions.length,
          accidentals: validation.analysis.accidentals.length,
        ),
      ),
    );
  }
  return result;
}

int _imul(int left, int right) {
  final leftLow = left & 0xffff;
  final leftHigh = (left >> 16) & 0xffff;
  final rightLow = right & 0xffff;
  final rightHigh = (right >> 16) & 0xffff;
  return (leftLow * rightLow +
          ((leftHigh * rightLow + leftLow * rightHigh) << 16)) &
      0xffffffff;
}

int _max(int left, int right) => left > right ? left : right;
int _min(int left, int right) => left < right ? left : right;
