<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

function request_ip(): ?string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';

    return $ip !== '' ? substr($ip, 0, 45) : null;
}

function request_user_agent(): ?string
{
    $agent = $_SERVER['HTTP_USER_AGENT'] ?? '';

    return $agent !== '' ? substr($agent, 0, 255) : null;
}

/**
 * Registra una acción en la bitácora. Nunca interrumpe la operación principal.
 */
function audit_log(
    string $action,
    string $entity,
    ?int $entityId = null,
    array $details = [],
    ?int $userId = null
): void {
    try {
        if ($userId === null) {
            $user = current_user();
            $userId = $user['id'] ?? null;
        }

        $statement = db()->prepare(
            'INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip_address, user_agent)
             VALUES (:user_id, :action, :entity, :entity_id, :details, :ip, :agent)'
        );

        $statement->execute([
            ':user_id'   => $userId,
            ':action'    => $action,
            ':entity'    => $entity,
            ':entity_id' => $entityId,
            ':details'   => $details === [] ? null : json_encode($details, JSON_UNESCAPED_UNICODE),
            ':ip'        => request_ip(),
            ':agent'     => request_user_agent(),
        ]);
    } catch (Throwable $error) {
        error_log('No se pudo escribir en audit_log: ' . $error->getMessage());
    }
}
