<?php
declare(strict_types=1);

/**
 * Escapa texto para HTML.
 */
function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
}

function role_label(string $role): string
{
    return $role === 'admin' ? 'Administrador' : 'Usuario';
}

function role_class(string $role): string
{
    return $role === 'admin' ? 'role-admin' : 'role-user';
}

function status_label(string $status): string
{
    return $status === 'activo' ? 'Activo' : 'Inactivo';
}

function format_datetime(?string $value): string
{
    if ($value === null || $value === '') {
        return '—';
    }

    $timestamp = strtotime($value);

    return $timestamp === false ? $value : date('d/m/Y H:i', $timestamp);
}

function format_date(?string $value): string
{
    if ($value === null || $value === '') {
        return '—';
    }

    $timestamp = strtotime($value);

    return $timestamp === false ? $value : date('d/m/Y', $timestamp);
}

function format_money(float|int|string|null $value): string
{
    return 'S/ ' . number_format((float) $value, 2, '.', ',');
}

function audit_action_label(string $action): string
{
    return [
        'login'             => 'Inicio de sesión',
        'login_failed'      => 'Intento de acceso fallido',
        'logout'            => 'Cierre de sesión',
        'asset_create'      => 'Bien registrado',
        'asset_update'      => 'Bien actualizado',
        'asset_delete'      => 'Bien eliminado',
        'asset_transfer'    => 'Bien trasladado',
        'user_create'       => 'Usuario creado',
        'user_update'       => 'Usuario actualizado',
        'user_status'       => 'Estado de usuario cambiado',
        'user_password'     => 'Contraseña restablecida',
        'password_change'   => 'Contraseña propia cambiada',
    ][$action] ?? $action;
}
