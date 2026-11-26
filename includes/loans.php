<?php
declare(strict_types=1);

function validate_asset_loan_input(array $input): array
{
    $errors = [];
    $borrower = trim((string) ($input['borrower'] ?? ''));
    if ($borrower === '' || mb_strlen($borrower) > 120) {
        $errors[] = 'La persona que recibe el bien es obligatoria (máximo 120 caracteres).';
    }

    $dueOn = trim((string) ($input['due_on'] ?? ''));
    if ($dueOn !== '') {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $dueOn);
        $dateErrors = DateTimeImmutable::getLastErrors();
        if ($date === false
            || $date->format('Y-m-d') !== $dueOn
            || ($dateErrors !== false && ($dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0))) {
            $errors[] = 'La fecha prevista de devolución no es válida.';
        }
    }

    $notes = trim((string) ($input['notes'] ?? ''));
    if (mb_strlen($notes) > 300) {
        $errors[] = 'Las observaciones del préstamo no deben superar 300 caracteres.';
    }

    return [[
        'borrower' => $borrower,
        'due_on' => $dueOn !== '' ? $dueOn : null,
        'notes' => $notes,
    ], $errors];
}

function fetch_asset_loans(PDO $pdo, int $assetId): array
{
    $statement = $pdo->prepare(
        'SELECT l.id, l.asset_id, l.borrower, l.loaned_at, l.due_on, l.returned_at, l.notes,
                loaner.name AS loaned_by_name, loaner.email AS loaned_by_email,
                returner.name AS returned_by_name, returner.email AS returned_by_email
         FROM asset_loans l
         LEFT JOIN users loaner ON loaner.id = l.loaned_by
         LEFT JOIN users returner ON returner.id = l.returned_by
         WHERE l.asset_id = :asset_id
         ORDER BY l.loaned_at DESC, l.id DESC'
    );
    $statement->execute([':asset_id' => $assetId]);

    return array_map(static function (array $loan): array {
        $loan['id'] = (int) $loan['id'];
        $loan['asset_id'] = (int) $loan['asset_id'];
        return $loan;
    }, $statement->fetchAll());
}
