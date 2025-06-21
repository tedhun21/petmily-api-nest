import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { ChatsService } from './chats.service';
import { FindMessagesDto } from './dto/find.messages.dto';
import { FindChatRoomsDto } from './dto/find.chatRooms.dto';
import { FindChatRoomByUsersDto } from './dto/find.chatRoomByUsersDto';
import { CreateChatRoomDto } from './dto/create.chatRoom.dto';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createChatRoom(
    @AuthUser() jwtUser: JwtUser,
    @Body() createChatRoomDto: CreateChatRoomDto,
  ) {
    return this.chatsService.createChatRoom(jwtUser, createChatRoomDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findChatRooms(
    @AuthUser() jwtUser: JwtUser,
    @Query() findChatRoomsDto: FindChatRoomsDto,
  ) {
    return this.chatsService.findChatRooms(jwtUser, findChatRoomsDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-users')
  findChatRoomByUsers(
    @AuthUser() jwtUser: JwtUser,
    @Query() query: FindChatRoomByUsersDto,
  ) {
    return this.chatsService.findChatRoomByUsers(jwtUser, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  getUnreadCountByUser(@AuthUser() jwtUser: JwtUser) {
    return this.chatsService.getUnreadMessageCountByUser(jwtUser);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':chatRoomId')
  findChatRoom(
    @AuthUser() jwtUser: JwtUser,
    @Param('chatRoomId', ParseIntPipe) chatRoomId: number,
  ) {
    return this.chatsService.findChatRoom(jwtUser, chatRoomId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':chatRoomId/messages')
  findMessages(
    @AuthUser() jwtUser: JwtUser,
    @Param('chatRoomId', ParseIntPipe) chatRoomId: number,
    @Query() findMessagesDto: FindMessagesDto,
  ) {
    return this.chatsService.findMessages(jwtUser, chatRoomId, findMessagesDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':chatRoomId/messages')
  createMessage(
    @AuthUser() jwtUser: JwtUser,
    @Param('chatRoomId', ParseIntPipe) chatRoomId: number,
    @Body() message: string,
  ) {
    return this.chatsService.createMessage(jwtUser, chatRoomId, message);
  }
}
